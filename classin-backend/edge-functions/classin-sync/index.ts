// ═════════════════════════════════════════════════════════════════
//  Supabase Edge Function — classin-sync
//  우리 홈페이지 회원가입 시 클래스인에 학생 계정 자동 등록 + UID 매핑 저장
//  ──────────────────────────────────────────────────────────────
//  배포:
//    1) Supabase → Edge Functions → "Create function" → 이름: classin-sync
//    2) 이 파일 내용 복붙 → Deploy
//    3) 환경변수(Secrets):
//        - CLASSIN_SID      : 클래스인 발급 SID
//        - CLASSIN_SECRET   : 클래스인 발급 SECRET (절대 노출 금지)
//        - CLASSIN_API_HOST : (선택) 기본 https://api.eeo.cn
//        - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//    4) 클라이언트는 가입 직후 fetch('/functions/v1/classin-sync', { email, name, telephone })
//
//  ClassIn 인증 규칙(v1):
//    safeKey = md5(SECRET + timeStamp)
//    POST body 에 SID, safeKey, timeStamp 포함
//
//  errno 의미:
//    1   = 신규 등록 성공
//    461 = 이메일이 이미 가입돼 있음 (data 에 기존 UID 가 옵니다)
//    135 = 휴대폰이 이미 가입돼 있음 (data 에 기존 UID)
// ═════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

// 순수 JS MD5 (Web Crypto 는 MD5 미지원 · Deno hash 모듈도 제거됨 → 직접 구현)
function md5(str: string): string {
  function safeAdd(x: number, y: number) { const l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
  function rol(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return safeAdd(rol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  const ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => cmn(c ^ (b | ~d), a, b, x, s, t);
  function core(x: number[], len: number) {
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (let i = 0; i < x.length; i += 16) {
      const oa = a, ob = b, oc = c, od = d;
      a = ff(a, b, c, d, x[i] | 0, 7, -680876936); d = ff(d, a, b, c, x[i + 1] | 0, 12, -389564586); c = ff(c, d, a, b, x[i + 2] | 0, 17, 606105819); b = ff(b, c, d, a, x[i + 3] | 0, 22, -1044525330);
      a = ff(a, b, c, d, x[i + 4] | 0, 7, -176418897); d = ff(d, a, b, c, x[i + 5] | 0, 12, 1200080426); c = ff(c, d, a, b, x[i + 6] | 0, 17, -1473231341); b = ff(b, c, d, a, x[i + 7] | 0, 22, -45705983);
      a = ff(a, b, c, d, x[i + 8] | 0, 7, 1770035416); d = ff(d, a, b, c, x[i + 9] | 0, 12, -1958414417); c = ff(c, d, a, b, x[i + 10] | 0, 17, -42063); b = ff(b, c, d, a, x[i + 11] | 0, 22, -1990404162);
      a = ff(a, b, c, d, x[i + 12] | 0, 7, 1804603682); d = ff(d, a, b, c, x[i + 13] | 0, 12, -40341101); c = ff(c, d, a, b, x[i + 14] | 0, 17, -1502002290); b = ff(b, c, d, a, x[i + 15] | 0, 22, 1236535329);
      a = gg(a, b, c, d, x[i + 1] | 0, 5, -165796510); d = gg(d, a, b, c, x[i + 6] | 0, 9, -1069501632); c = gg(c, d, a, b, x[i + 11] | 0, 14, 643717713); b = gg(b, c, d, a, x[i] | 0, 20, -373897302);
      a = gg(a, b, c, d, x[i + 5] | 0, 5, -701558691); d = gg(d, a, b, c, x[i + 10] | 0, 9, 38016083); c = gg(c, d, a, b, x[i + 15] | 0, 14, -660478335); b = gg(b, c, d, a, x[i + 4] | 0, 20, -405537848);
      a = gg(a, b, c, d, x[i + 9] | 0, 5, 568446438); d = gg(d, a, b, c, x[i + 14] | 0, 9, -1019803690); c = gg(c, d, a, b, x[i + 3] | 0, 14, -187363961); b = gg(b, c, d, a, x[i + 8] | 0, 20, 1163531501);
      a = gg(a, b, c, d, x[i + 13] | 0, 5, -1444681467); d = gg(d, a, b, c, x[i + 2] | 0, 9, -51403784); c = gg(c, d, a, b, x[i + 7] | 0, 14, 1735328473); b = gg(b, c, d, a, x[i + 12] | 0, 20, -1926607734);
      a = hh(a, b, c, d, x[i + 5] | 0, 4, -378558); d = hh(d, a, b, c, x[i + 8] | 0, 11, -2022574463); c = hh(c, d, a, b, x[i + 11] | 0, 16, 1839030562); b = hh(b, c, d, a, x[i + 14] | 0, 23, -35309556);
      a = hh(a, b, c, d, x[i + 1] | 0, 4, -1530992060); d = hh(d, a, b, c, x[i + 4] | 0, 11, 1272893353); c = hh(c, d, a, b, x[i + 7] | 0, 16, -155497632); b = hh(b, c, d, a, x[i + 10] | 0, 23, -1094730640);
      a = hh(a, b, c, d, x[i + 13] | 0, 4, 681279174); d = hh(d, a, b, c, x[i] | 0, 11, -358537222); c = hh(c, d, a, b, x[i + 3] | 0, 16, -722521979); b = hh(b, c, d, a, x[i + 6] | 0, 23, 76029189);
      a = hh(a, b, c, d, x[i + 9] | 0, 4, -640364487); d = hh(d, a, b, c, x[i + 12] | 0, 11, -421815835); c = hh(c, d, a, b, x[i + 15] | 0, 16, 530742520); b = hh(b, c, d, a, x[i + 2] | 0, 23, -995338651);
      a = ii(a, b, c, d, x[i] | 0, 6, -198630844); d = ii(d, a, b, c, x[i + 7] | 0, 10, 1126891415); c = ii(c, d, a, b, x[i + 14] | 0, 15, -1416354905); b = ii(b, c, d, a, x[i + 5] | 0, 21, -57434055);
      a = ii(a, b, c, d, x[i + 12] | 0, 6, 1700485571); d = ii(d, a, b, c, x[i + 3] | 0, 10, -1894986606); c = ii(c, d, a, b, x[i + 10] | 0, 15, -1051523); b = ii(b, c, d, a, x[i + 1] | 0, 21, -2054922799);
      a = ii(a, b, c, d, x[i + 8] | 0, 6, 1873313359); d = ii(d, a, b, c, x[i + 15] | 0, 10, -30611744); c = ii(c, d, a, b, x[i + 6] | 0, 15, -1560198380); b = ii(b, c, d, a, x[i + 13] | 0, 21, 1309151649);
      a = ii(a, b, c, d, x[i + 4] | 0, 6, -145523070); d = ii(d, a, b, c, x[i + 11] | 0, 10, -1120210379); c = ii(c, d, a, b, x[i + 2] | 0, 15, 718787259); b = ii(b, c, d, a, x[i + 9] | 0, 21, -343485551);
      a = safeAdd(a, oa); b = safeAdd(b, ob); c = safeAdd(c, oc); d = safeAdd(d, od);
    }
    return [a, b, c, d];
  }
  const bytes = new TextEncoder().encode(str);
  const bin: number[] = [];
  for (let i = 0; i < bytes.length * 8; i += 8) bin[i >> 5] |= bytes[i / 8] << (i % 32);
  const out = core(bin, bytes.length * 8);
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < out.length * 4; i++) {
    s += hex.charAt((out[i >> 2] >> ((i % 4) * 8 + 4)) & 0xf) + hex.charAt((out[i >> 2] >> ((i % 4) * 8)) & 0xf);
  }
  return s;
}

async function callClassInRegister(opts: {
  sid: string; secret: string; apiHost: string;
  email: string; password: string; name?: string; telephone?: string; role: "student" | "teacher";
}) {
  const ts = Math.floor(Date.now() / 1000);
  const safeKey = md5(opts.secret + ts);
  const md5pass = md5(opts.password);

  const params: Record<string, string | number> = {
    email:             opts.email,
    md5pass,
    addToSchoolMember: opts.role === "teacher" ? 2 : 1,
    SID:               opts.sid,
    safeKey,
    timeStamp:         ts,
  };
  if (opts.name)      params.nickname  = opts.name;
  if (opts.telephone) params.telephone = opts.telephone;

  const body = new URLSearchParams();
  for (const k in params) body.set(k, String(params[k]));

  const url = opts.apiHost.replace(/\/$/, "") + "/partner/api/course.api.php?action=register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = { _raw: text }; }
  return { httpStatus: res.status, raw: text, json: parsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ ok: false, message: "POST 만 지원합니다" }, 405);

  // 인증된 사용자만 본인 계정을 동기화할 수 있게: 호출한 JWT 의 user 정보를 사용
  const supaPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await supaPublic.auth.getUser();
  if (!user) return json({ ok: false, message: "로그인이 필요합니다" }, 401);

  let body: { name?: string; telephone?: string; role?: string };
  try { body = await req.json(); } catch { body = {}; }
  const email = user.email || "";
  if (!email) return json({ ok: false, message: "이메일이 없는 계정입니다" }, 400);
  const role = body.role === "teacher" ? "teacher" : "student";
  const name = body.name || (user.user_metadata?.name as string) || "";
  const telephone = body.telephone || (user.user_metadata?.phone as string) || "";

  const SID     = Deno.env.get("CLASSIN_SID");
  const SECRET  = Deno.env.get("CLASSIN_SECRET");
  const APIHOST = Deno.env.get("CLASSIN_API_HOST") || "https://api.eeo.cn";
  if (!SID || !SECRET) return json({ ok: false, message: "서버에 CLASSIN_SID/SECRET 가 설정돼 있지 않습니다" }, 500);

  // 임시 비밀번호 (학생은 사이트 자체 로그인을 쓰고, 클래스인은 원클릭 입장만 쓰므로 직접 사용 X)
  const password = md5(email + Date.now() + Math.random()).slice(0, 12);

  let r;
  try {
    r = await callClassInRegister({ sid: SID, secret: SECRET, apiHost: APIHOST, email, password, name, telephone, role });
  } catch (e) {
    return json({ ok: false, message: "클래스인 호출 실패: " + String(e) }, 502);
  }

  const errno = Number(r.json?.error_info?.errno ?? 0);
  const uid   = String(r.json?.data ?? "").trim();

  // errno: 1=신규, 461=이메일 이미가입(기존 UID 반환), 135=휴대폰 이미가입(기존 UID 반환)
  if (!uid && ![1, 461, 135].includes(errno)) {
    return json({ ok: false, code: errno, message: "클래스인 계정 등록 실패", detail: r.json }, 502);
  }

  // profiles 에 매핑 저장 (service_role 로 RLS 우회)
  const supaService = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  await supaService.from("profiles").update({
    classin_uid: uid,
    classin_role: role,
    classin_linked_at: new Date().toISOString(),
  }).eq("id", user.id);

  // 가입 이전에 쌓인 클래스인 데이터를 이 회원에게 소급 연결
  //   classin-hook 은 데이터를 "받는 시점"에만 member_id 를 매칭한다. 그래서 나중에
  //   가입한 학생은 가입 전 성적·출결이 member_id 없이 남아 본인 화면에서 안 보인다.
  //   여기서 UID 기준으로 메워준다. (구버전 PHP sync-user.php 가 하던 소급 연결)
  const backfilled: Record<string, number> = {};
  if (uid) {
    for (const t of ["classin_scores", "classin_attendance", "classin_rewards", "classin_interactions"]) {
      try {
        const { data, error } = await supaService.from(t)
          .update({ member_id: user.id })
          .eq("student_uid", uid)
          .is("member_id", null)
          .select("student_uid");
        if (!error) backfilled[t] = (data || []).length;
      } catch (_e) { /* 표가 없어도 가입 자체는 계속 진행 */ }
    }
  }

  return json({
    ok: true,
    uid,
    existed:   [461, 135].includes(errno),
    matchedBy: errno === 461 ? "email" : (errno === 135 ? "telephone" : "new"),
    role,
    backfilled,
  });
});
