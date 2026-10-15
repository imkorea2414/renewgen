/* global React, window, DOMPurify, tinymce */
// ─────────────────────────────────────────────────────────────────
//  게시판 본문 편집기(TinyMCE) + HTML sanitize/본문이미지 처리 공용 함수.
//
//  본문 안에 삽입된 이미지(인라인 이미지)는 PRIVATE 버킷(board-attachments)에
//  올라가므로, 저장되는 content(HTML 문자열) 안에는 "영구 URL"을 절대
//  남기지 않는다 — 대신 <img data-board-path="...">만 남기고, 화면에
//  보여줄 때(관리자 미리보기/공개 상세 페이지) 그 자리에서 매번 새로
//  짧은 서명 URL을 발급해 src를 채운다(hydrateInlineImages). 이렇게 해야
//  "게시글을 나중에 비공개로 바꿔도 과거에 저장해 둔 URL로 계속 열람되는"
//  문제가 본문 이미지에서도 똑같이 생기지 않는다(첨부파일과 동일한 원칙).
// ─────────────────────────────────────────────────────────────────

// sanitize 허용 태그/속성 — 요구된 편집 기능(제목/소제목/굵게/밑줄/색상/
// 글머리표/번호목록/표/링크/이미지/정렬)에 대응하는 것만 허용한다.
const BOARD_HTML_ALLOWED_TAGS = [
  "p", "h2", "h3", "strong", "u", "em", "br", "span",
  "ul", "ol", "li",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "img",
];
const BOARD_HTML_ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "data-board-path", "style", "class", "colspan", "rowspan"];
// style 속성은 DOMPurify가 값 자체를 검증하진 않으므로, 허용하는 CSS
// 프로퍼티를 글자색·정렬·굵기 등 이번 요구 기능 범위로만 한정한다.
const BOARD_HTML_ALLOWED_STYLE = /^(color|text-align|font-weight|font-size)\s*:\s*[^;]+;?$/i;

function sanitizeStyleAttr(html) {
  // DOMPurify 실행 전, style="..." 안의 각 선언을 화이트리스트로 직접 거른다.
  return html.replace(/style="([^"]*)"/gi, (m, decls) => {
    const kept = decls.split(";").map((d) => d.trim()).filter(Boolean)
      .filter((d) => BOARD_HTML_ALLOWED_STYLE.test(d + ";"));
    return kept.length ? `style="${kept.join("; ")}"` : "";
  });
}

// 저장 전/출력 전 양쪽에서 호출한다 — "저장된 값도 신뢰하지 않는다" 원칙.
function sanitizeBoardHtml(html) {
  if (!html) return "";
  const pre = sanitizeStyleAttr(String(html));
  if (!(window.DOMPurify)) {
    // DOMPurify 로드 실패 시 서식을 포기하고 텍스트만 안전하게 보존한다
    // (아무것도 못 거르는 상태로 HTML을 그대로 내보내는 것보다 안전).
    const tmp = document.createElement("div");
    tmp.textContent = pre.replace(/<[^>]*>/g, "");
    return tmp.innerHTML;
  }
  return window.DOMPurify.sanitize(pre, {
    ALLOWED_TAGS: BOARD_HTML_ALLOWED_TAGS,
    ALLOWED_ATTR: BOARD_HTML_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false, // data-board-path는 ALLOWED_ATTR에 명시했으니 전체 data-* 허용은 불필요
  });
}

// 에디터가 막 삽입한 <img src="(90초 서명URL)">를 data-board-path 전용으로
// 바꾸고 src는 비운다 — 저장되는 content 문자열에 서명 URL이 들어가지 않게.
function stripInlineImageUrls(html) {
  if (!html) return html;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  tmp.querySelectorAll("img[data-board-path]").forEach((img) => {
    img.removeAttribute("src");
    img.setAttribute("alt", img.getAttribute("alt") || "본문 이미지");
  });
  return tmp.innerHTML;
}

// 화면에 실제로 보여줄 때 호출 — data-board-path만 있고 src가 비어있는
// <img>를 찾아 그 순간 서명 URL을 새로 발급해 채운다. 90초가 지나 다시
// 보이지 않으면(예: 오래 열어둔 탭) 그냥 깨진 이미지로 보일 뿐 보안
// 문제는 아니다 — 새로고침하면 다시 채워진다.
async function hydrateInlineImages(containerEl) {
  if (!containerEl || !window.getBoardAttachmentUrl) return;
  const imgs = Array.from(containerEl.querySelectorAll("img[data-board-path]:not([data-hydrated])"));
  for (const img of imgs) {
    img.setAttribute("data-hydrated", "1");
    const path = img.getAttribute("data-board-path");
    const r = await window.getBoardAttachmentUrl(path, 90);
    if (r.ok) img.src = r.url;
  }
}

// ── TinyMCE 래퍼 ────────────────────────────────────────────────────
//   value: 현재 HTML(없으면 빈 에디터) / onChange(html): 변경될 때마다 호출
//   postId: 본문 이미지 업로드 시 board_attachments.post_id로 쓸 값(없으면
//   이미지 삽입을 비활성화 — 게시글을 먼저 임시저장해야 본문에 이미지를
//   넣을 수 있다는 뜻, BoardPostForm에서 안내 문구로 처리).
function BoardEditor({ value, onChange, postId, disabled }) {
  const hostRef = React.useRef(null);
  const idRef = React.useRef("board-editor-" + Math.random().toString(36).slice(2));
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const postIdRef = React.useRef(postId);
  postIdRef.current = postId;
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let editorInstance = null;

    function uploadHandler(blobInfo) {
      return new Promise((resolve, reject) => {
        const pid = postIdRef.current;
        if (!pid) { reject("게시글을 먼저 임시저장한 뒤 이미지를 삽입해 주세요"); return; }
        const file = blobInfo.blob();
        window.uploadBoardAttachment({ postId: pid, file, kind: "inline_image", ordinal: 0 }).then((r) => {
          if (!r.ok) { reject(r.error || "이미지 업로드에 실패했습니다"); return; }
          window.getBoardAttachmentUrl(r.attachment.storage_path, 90).then((su) => {
            if (!su.ok) { reject("이미지 URL 발급에 실패했습니다"); return; }
            resolve(su.url);
            // 삽입 직후 해당 <img>에 data-board-path를 붙인다(저장 시 src 제거용).
            setTimeout(() => {
              if (!editorInstance) return;
              const img = editorInstance.dom.select('img[src="' + su.url + '"]')[0];
              if (img) img.setAttribute("data-board-path", r.attachment.storage_path);
            }, 0);
          });
        });
      });
    }

    tinymce.init({
      target: hostRef.current,
      height: 420,
      menubar: false,
      branding: false,
      readonly: !!disabled,
      plugins: "advlist lists link image table preview wordcount fullscreen",
      toolbar: "undo redo | blocks | bold underline | forecolor | fontsize | alignleft aligncenter alignright | bullist numlist | link image table | preview fullscreen",
      block_formats: "본문=p; 제목=h2; 소제목=h3",
      font_size_formats: "13px 15.5px 18px 22px 28px",
      content_style:
        "body{font-family:'Pretendard Variable',Pretendard,system-ui,sans-serif;font-size:15.5px;line-height:1.8;color:#001D3D}" +
        "h2{font-size:22px;font-weight:700;margin:28px 0 10px}" +
        "h3{font-size:18px;font-weight:700;margin:22px 0 8px}" +
        "table{border-collapse:collapse;width:100%}" +
        "table td,table th{border:1px solid #E4DCC6;padding:8px 10px}" +
        "img{max-width:100%;height:auto}",
      images_upload_handler: uploadHandler,
      image_uploadtab: true,
      automatic_uploads: true,
      paste_data_images: false,
      setup: (editor) => {
        editorInstance = editor;
        editor.on("init", () => { if (!cancelled) { editor.setContent(value || ""); setReady(true); } });
        editor.on("Change KeyUp Undo Redo", () => {
          if (onChangeRef.current) onChangeRef.current(editor.getContent());
        });
      },
    });

    return () => {
      cancelled = true;
      try { tinymce.get(idRef.current) && tinymce.get(idRef.current).remove(); } catch (e) {}
      try { editorInstance && editorInstance.remove(); } catch (e) {}
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div>
      <textarea ref={hostRef} id={idRef.current} style={{ visibility: ready ? "visible" : "hidden" }} />
      {!ready && <div style={{ padding: 20, textAlign: "center", color: "var(--ci-muted)", fontSize: 13 }}>편집기를 불러오는 중…</div>}
    </div>
  );
}

// 과거 평문 글을 에디터에 처음 불러올 때만 쓴다 — 줄바꿈 구조를 그대로
// 보존한 HTML로 1회 변환한다(이후 저장되면 content_format='html'로 승격).
function textToSafeHtml(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = String(text || "").split(/\n/);
  return lines.map((line) => "<p>" + (line ? esc(line) : "<br>") + "</p>").join("");
}

Object.assign(window, {
  sanitizeBoardHtml, stripInlineImageUrls, hydrateInlineImages, BoardEditor, textToSafeHtml,
});
