// ═════════════════════════════════════════════════════════════════
//  Supabase Edge Function — vimeo-list
//  관리자가 "강좌 개설" 화면에서 Vimeo 링크를 직접 붙여넣지 않고,
//  본인 Vimeo 계정의 영상/쇼케이스 목록을 불러와 골라 쓸 수 있게 한다.
//  ──────────────────────────────────────────────────────────────
//  배포:
//    1) Supabase → Edge Functions → "Create function" → 이름: vimeo-list
//    2) 이 파일 내용 복붙 → Deploy ("Verify JWT" 는 켜두어도/꺼두어도 무방 —
//       함수 내부에서 관리자 권한을 직접 검사합니다)
//    3) 환경변수(Secrets):
//        - VIMEO_ACCESS_TOKEN : Vimeo Personal Access Token
//                               (scope: public, private, video_files)
//        - ADMIN_EMAILS       : (선택) 콤마 구분 관리자 이메일 목록
//        - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//    4) 클라이언트 호출 예:
//        GET /functions/v1/vimeo-list?type=videos&page=1&per_page=25
//        GET /functions/v1/vimeo-list?type=showcases
//        GET /functions/v1/vimeo-list?type=showcase-videos&showcase_id=123
// ═════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "koreayjk@gmail.com,twinkle347@naver.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const STAFF_ROLES = ["admin", "staff", "teacher"];

// Vimeo 응답 하나(영상 또는 쇼케이스)를 강좌 개설 폼이 바로 쓸 수 있는 모양으로 축약
function simplify(v: any) {
  const uri: string = v?.uri || "";
  const id = uri.split("/").filter(Boolean).pop() || "";
  const pic = v?.pictures?.sizes?.length ? v.pictures.sizes[v.pictures.sizes.length - 1].link : "";
  return {
    id,
    name: v?.name || "(제목 없음)",
    link: v?.link || "",                              // parseVimeoMedia() 가 그대로 인식하는 형식
    thumbnail: pic,
    duration: v?.duration || 0,                        // 초 단위 (영상만 해당)
    privacy: v?.privacy?.view || "",
    videoCount: v?.metadata?.connections?.videos?.total ?? undefined, // 쇼케이스만 해당
    createdTime: v?.created_time || "",
  };
}

async function vimeoFetch(path: string, token: string) {
  const res = await fetch("https://api.vimeo.com" + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    },
  });
  const text = await res.text();
  let j: any; try { j = JSON.parse(text); } catch { j = { _raw: text.slice(0, 2000) }; }
  return { httpStatus: res.status, json: j };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ ok: false, msg: "GET 만 지원합니다" }, 405);

  // ── 관리자 인증 (classin-roster 와 동일한 방식) ──────────────────
  const supaPublic = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await supaPublic.auth.getUser();
  if (!user) return json({ ok: false, msg: "로그인이 필요합니다" }, 401);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  let allowed = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  if (!allowed) {
    try {
      const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
      allowed = !!prof && STAFF_ROLES.includes(String(prof.role || "").toLowerCase());
    } catch (_e) { /* 거부 */ }
  }
  if (!allowed) return json({ ok: false, msg: "권한이 없습니다(관리자 전용)" }, 403);

  // ── 파라미터 ──────────────────────────────────────────────────
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "videos").toLowerCase();
  const page = url.searchParams.get("page") || "1";
  const perPage = Math.min(100, Number(url.searchParams.get("per_page") || "25")).toString();
  const showcaseId = url.searchParams.get("showcase_id") || "";
  const q = url.searchParams.get("q") || "";

  const TOKEN = Deno.env.get("VIMEO_ACCESS_TOKEN");
  if (!TOKEN) return json({ ok: false, msg: "서버에 VIMEO_ACCESS_TOKEN 이 설정돼 있지 않습니다" }, 500);

  const FIELDS = "uri,name,link,duration,created_time,privacy.view,pictures.sizes,metadata.connections.videos.total";
  const qs = (extra = "") =>
    `page=${encodeURIComponent(page)}&per_page=${encodeURIComponent(perPage)}&fields=${encodeURIComponent(FIELDS)}`
    + (q ? `&query=${encodeURIComponent(q)}` : "") + extra;

  let path = "";
  if (type === "videos") path = "/me/videos?" + qs();
  else if (type === "showcases") path = "/me/albums?" + qs();
  else if (type === "showcase-videos") {
    if (!showcaseId) return json({ ok: false, msg: "showcase_id 가 필요합니다" }, 400);
    path = `/me/albums/${encodeURIComponent(showcaseId)}/videos?` + qs();
  } else return json({ ok: false, msg: "type 은 videos | showcases | showcase-videos 중 하나여야 합니다" }, 400);

  try {
    const r = await vimeoFetch(path, TOKEN);
    if (r.httpStatus === 401) return json({ ok: false, msg: "Vimeo 토큰이 유효하지 않습니다(만료/철회 여부 확인)", detail: r.json }, 502);
    if (r.httpStatus === 403) return json({ ok: false, msg: "Vimeo 토큰 권한(scope) 부족 — Private/Video Files 스코프 확인", detail: r.json }, 502);
    if (r.httpStatus >= 400) return json({ ok: false, msg: "Vimeo API 오류", detail: r.json }, 502);

    const items = Array.isArray(r.json?.data) ? r.json.data.map(simplify) : [];
    return json({ ok: true, type, page: Number(page), total: r.json?.total ?? items.length, items });
  } catch (e) {
    return json({ ok: false, msg: "Vimeo 호출 실패: " + String((e as any)?.message ?? e) }, 502);
  }
});
