/* global React, COURSES, useApp, Icon, findCourse, findInstructor */

const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

// ──────────────────────────────────────────────────────────────────
// /player/:id  — VOD viewer
// ──────────────────────────────────────────────────────────────────
function PlayerPage({ courseId }) {
  const { navigate, user } = useApp();
  const course = findCourse(courseId);
  const ins = course ? findInstructor(course.instructor) : null;
  const [activeLesson, setActiveLesson] = useStateP(2);
  const [playing, setPlaying] = useStateP(true);
  const [progress, setProgress] = useStateP(0.32);
  const [speed, setSpeed] = useStateP(1.0);
  const [showNotes, setShowNotes] = useStateP(true);
  const [chapterIdx, setChapterIdx] = useStateP(2);
  const [access, setAccess] = useStateP(null); // null=확인중, {canWatch, reason}
  const [studentLessons, setStudentLessons] = useStateP(null); // null=확인 전, {ok, reason, lessons}
  const [buyOpen, setBuyOpen] = useStateP(false);

  // 접근권 판정 (구독자 무료 / 구매자 / 잠금)
  useEffectP(() => {
    let alive = true;
    if (!course) return;
    window.resolveAccess(user, course).then((a) => { if (alive) setAccess(a); });
    return () => { alive = false; };
  }, [user, courseId]);

  // STEP4: 관리자가 실제로 등록한 차시(lessons)가 있는지 서버에 물어본다.
  // vod_get_student_lessons 는 자체적으로 권한을 재검증하므로 프론트의 access/RJ_PUBLIC_PREVIEW 와
  // 무관하게, 실제 수강 권한이 없으면 lessons 를 절대 돌려주지 않는다.
  useEffectP(() => {
    let alive = true;
    setStudentLessons(null);
    if (!course) return;
    window.vodFetchStudentLessons(course.id).then((r) => { if (alive) setStudentLessons(r); });
    return () => { alive = false; };
  }, [courseId]);

  // Fake progress ticker
  useEffectP(() => {
    if (!playing) return;
    const t = setInterval(() => setProgress((p) => Math.min(0.999, p + 0.001 * speed)), 90);
    return () => clearInterval(t);
  }, [playing, speed]);

  if (!course) {
    return (
      <div className="container" style={{ padding: "120px 0", textAlign: "center" }}>
        <h2>강의를 찾을 수 없습니다.</h2>
        <button className="btn btn-primary" onClick={() => navigate("/courses")} style={{ marginTop: 20 }}>강의 목록으로</button>
      </div>
    );
  }

  // 접근권에 따른 게이트: 로그인 필요 / 잠김(구독·구매 유도)
  const gate = access && !access.canWatch ? access.reason : null;
  if (gate === "need-login") {
    return (
      <div className="container" style={{ padding: "120px 0", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--rj-ink)", color: "var(--rj-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Icon name="lock" size={26} /></div>
        <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 30, letterSpacing: "-0.03em", margin: "22px 0 8px" }}>로그인이 필요합니다</h2>
        <p style={{ color: "var(--rj-muted)", marginBottom: 26 }}>로그인 후 구독 또는 구매한 강의의 다시보기를 시청할 수 있습니다.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/login")}>로그인</button>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate("/courses/" + course.id)}>강의 소개</button>
        </div>
      </div>
    );
  }
  if (gate === "locked") {
    const won = (n) => (n / 10000) + "만원";
    return (
      <div className="container" style={{ padding: "96px 0", maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--rj-ink)", color: "var(--rj-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Icon name="lock" size={26} /></div>
          <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.03em", margin: "22px 0 8px" }}>{course.title}</h2>
          <p style={{ color: "var(--rj-muted)", marginBottom: 36 }}>이 강의의 다시보기는 구독자는 무료, 비구독자는 개별 구매 후 시청할 수 있습니다.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* 구독 */}
          <div style={{ border: "2px solid var(--rj-ink)", borderRadius: 16, padding: "28px 26px", background: "var(--rj-ink)", color: "#fff", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--rj-accent)", color: "var(--rj-ink)", fontWeight: 800, fontSize: 12, padding: "5px 11px", borderRadius: 999, alignSelf: "flex-start" }}>★ 가장 인기</div>
            <h3 style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", margin: "16px 0 4px" }}>월정액 구독</h3>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.6 }}>라이브 수업 + <strong style={{ color: "#fff" }}>모든 녹화본 무제한</strong> 시청</p>
            <div style={{ fontFamily: "var(--font-en)", fontWeight: 800, fontSize: 30, margin: "18px 0 2px" }}>월 9.9<span style={{ fontSize: 16 }}>만원</span></div>
            <button className="btn btn-accent btn-lg" style={{ marginTop: "auto" }} onClick={() => navigate("/subscribe")}>구독하고 무료로 보기</button>
          </div>
          {/* 낙개 구매 */}
          <div style={{ border: "1px solid var(--rj-line)", borderRadius: 16, padding: "28px 26px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--rj-paper-2)", color: "var(--rj-muted)", fontWeight: 800, fontSize: 12, padding: "5px 11px", borderRadius: 999, alignSelf: "flex-start" }}>단건 구매</div>
            <h3 style={{ fontWeight: 900, fontSize: 22, letterSpacing: "-0.03em", margin: "16px 0 4px", color: "var(--rj-ink)" }}>이 강의만 구매</h3>
            <p style={{ fontSize: 13.5, color: "var(--rj-muted)", margin: 0, lineHeight: 1.6 }}>{course.title} 녹화본 전체를 <strong style={{ color: "var(--rj-ink)" }}>평생 소장</strong></p>
            <div style={{ fontFamily: "var(--font-en)", fontWeight: 800, fontSize: 30, margin: "18px 0 2px", color: "var(--rj-ink)" }}>{won(course.recordingPrice || course.salePrice || course.price || 300000)}</div>
            <button className="btn btn-primary btn-lg" style={{ marginTop: "auto" }} onClick={() => setBuyOpen(true)}>이 강의 구매하기</button>
            <p style={{ fontSize: 11.5, color: "var(--rj-muted)", textAlign: "center", margin: "10px 0 0" }}>토스페이먼츠 안전결제</p>
          </div>
        </div>
        {buyOpen && (
          <window.VodBuyModal
            course={course}
            user={user}
            onClose={() => setBuyOpen(false)}
            onPlay={async () => {
              setBuyOpen(false);
              const a = await window.resolveAccess(user, course); setAccess(a);
              const sl = await window.vodFetchStudentLessons(course.id); setStudentLessons(sl);
            }}
          />
        )}
      </div>
    );
  }

  // STEP4: 관리자가 실제로 등록한 차시(lessons)가 있는 강좌 → 새 차시 플레이어
  // (studentLessons 는 서버가 이미 실제 권한을 검증한 뒤 반환한 값 — 여기서는 그 결과만 사용한다)
  if (studentLessons && studentLessons.ok && studentLessons.lessons && studentLessons.lessons.length > 0) {
    return <LessonsPlayer course={course} ins={ins} lessons={studentLessons.lessons} reason={studentLessons.reason} onBack={() => navigate("/courses/" + course.id)} />;
  }

  // 쇼케이스(여러 강의)가 연결된 강좌 → 쇼케이스 플레이어로 (lessons==0 인 기존 강좌는 이 경로 그대로 유지)
  if (course.showcaseId) {
    return <ShowcasePlayer course={course} ins={ins} access={access} onBack={() => navigate("/courses/" + course.id)} />;
  }

  const chapters = [
    { t: "0:00", title: "오늘의 핵심 개념", endPct: 0.18 },
    { t: "8:42", title: "예제 1 — 극한의 정의 재확인", endPct: 0.34 },
    { t: "17:24", title: "예제 2 — 좌·우극한의 분리", endPct: 0.52 },
    { t: "26:08", title: "예제 3 — 연속과 미분가능성", endPct: 0.74 },
    { t: "38:11", title: "마무리 정리·다음 시간 예고", endPct: 1.0 },
  ];

  const lessons = course.syllabus.flatMap((s, i) => Array.from({ length: s.lessons }, (_, j) => ({
    id: `${i}-${j}`,
    title: `${s.title} — ${j === 0 ? "라이브" : "다시보기 " + j}`,
    weekUnit: s.unit,
    duration: ["28:14", "32:08", "29:42"][j % 3],
    type: j === 0 ? "live" : "vod",
  })));

  return (
    <div className="page-enter" style={{ background: "#000", color: "var(--rj-paper)", minHeight: "calc(100vh - 72px)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", minHeight: "calc(100vh - 72px)" }}>
        {/* Player + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Player surface */}
          <div style={{ position: "relative", background: "#0c0c0c", aspectRatio: "16 / 9" }}>
            <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.12 }} />
            {/* 실제 Vimeo 임베드 (접근 허용 + vimeoId 있을 때) */}
            {access && access.canWatch && course.vimeoId ? (
              <iframe
                title={course.title}
                src={window.videoEmbedSrc(course.vimeoId, course.vimeoHash)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
            /* Fake "video" composition (vimeoId 미설정 시 데모 표시) */
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18, opacity: playing ? 0.5 : 0.95, transition: "opacity .2s" }}>
              <div style={{ fontFamily: "var(--font-en)", fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Now Playing</div>
              <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 36, textAlign: "center", maxWidth: 720 }}>{lessons[activeLesson].title}</div>
              {!playing && (
                <button className="btn-circle" style={{ width: 88, height: 88, background: "var(--rj-accent)", color: "var(--rj-ink)" }} onClick={() => setPlaying(true)}>
                  <Icon name="play" size={36} />
                </button>
              )}
            </div>
            )}
            {/* 접근 허용 시 시청 배지 */}
            {access && access.canWatch && (
              <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 5, display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, backdropFilter: "blur(8px)" }}>
                {access.reason === "subscriber" ? "✓ 구독중 — 무제한 시청" : access.reason === "purchased" ? "✓ 구매한 강의" : access.reason === "enrolled" ? "✓ 수강생 무료 다시보기" : access.reason === "staff" ? "관리자 미리보기" : "무료 공개"}
              </div>
            )}
            {/* Top overlay */}
            <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn btn-sm" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }} onClick={() => navigate("/courses/" + course.id)}>
                <Icon name="arrowLeft" size={14} /> {course.title}
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="icon-btn" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)" }}><Icon name="bookmark" size={14} /></button>
                <button className="icon-btn" style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", backdropFilter: "blur(8px)" }}><Icon name="download" size={14} /></button>
              </div>
            </div>

            {/* Bottom controls */}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 20px 18px", background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
              {/* Scrubber with chapter ticks */}
              <div style={{ position: "relative", height: 16, marginBottom: 8, cursor: "pointer" }} onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
                setProgress(p);
              }}>
                <div style={{ position: "absolute", top: 7, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
                <div style={{ position: "absolute", top: 7, left: 0, width: progress * 100 + "%", height: 3, background: "var(--rj-accent)", borderRadius: 2 }} />
                {chapters.slice(0, -1).map((c, i) => (
                  <div key={i} style={{ position: "absolute", top: 4, left: c.endPct * 100 + "%", width: 2, height: 9, background: "rgba(255,255,255,0.5)", transform: "translateX(-1px)" }} />
                ))}
                <div style={{ position: "absolute", top: 1, left: `calc(${progress * 100}% - 7px)`, width: 14, height: 14, background: "var(--rj-accent)", borderRadius: "50%" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button className="icon-btn" style={{ color: "#fff" }} onClick={() => setPlaying((p) => !p)}>
                    <Icon name={playing ? "pause" : "play"} size={20} />
                  </button>
                  <button className="icon-btn" style={{ color: "#fff" }} onClick={() => setActiveLesson((i) => Math.max(0, i - 1))}><Icon name="arrowLeft" size={16} /></button>
                  <button className="icon-btn" style={{ color: "#fff" }} onClick={() => setActiveLesson((i) => Math.min(lessons.length - 1, i + 1))}><Icon name="arrow" size={16} /></button>
                  <span className="num-en" style={{ fontSize: 13, marginLeft: 8 }}>{fmtTime(progress * 2754)} / 45:54</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 12, padding: "4px 8px", fontFamily: "var(--font-en)" }}>
                    {[0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((s) => <option key={s} value={s}>{s.toFixed(2)}x</option>)}
                  </select>
                  <button className="icon-btn" style={{ color: "#fff" }} aria-label="자막">CC</button>
                  <button className="icon-btn" style={{ color: "#fff" }} aria-label="PIP"><Icon name="eye" size={16} /></button>
                  <button className="icon-btn" style={{ color: "#fff" }} aria-label="전체화면"><Icon name="plus" size={16} /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs under player */}
          <div style={{ padding: 32, color: "var(--rj-paper)", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
              <div>
                <div className="eyebrow" style={{ color: "rgba(245,241,233,0.5)" }}>{lessons[activeLesson].weekUnit} · LESSON {String(activeLesson + 1).padStart(2, "0")}</div>
                <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.025em", margin: "10px 0 6px" }}>{lessons[activeLesson].title}</h1>
                <div style={{ fontSize: 14, color: "rgba(245,241,233,0.6)" }}>{ins?.name} · {course.title}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-sm" style={{ background: "rgba(245,241,233,0.1)", color: "#fff", border: "1px solid rgba(245,241,233,0.18)" }}>
                  <Icon name="chat" size={14} /> 강사에게 질문
                </button>
                <button className="btn btn-sm" style={{ background: "rgba(245,241,233,0.1)", color: "#fff", border: "1px solid rgba(245,241,233,0.18)" }}>
                  <Icon name="pdf" size={14} /> 자료 다운로드
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, marginTop: 36 }}>
              <div>
                <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 20, letterSpacing: "-0.025em", margin: 0 }}>Chapters · 챕터</h3>
                <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                  {chapters.map((c, i) => (
                    <button key={i} onClick={() => { setChapterIdx(i); setProgress(i === 0 ? 0 : chapters[i - 1].endPct); }} style={{
                      textAlign: "left", padding: "12px 16px", borderRadius: "var(--rj-r-sm)",
                      background: chapterIdx === i ? "rgba(251,244,189,0.1)" : "transparent",
                      borderLeft: chapterIdx === i ? "2px solid var(--rj-accent)" : "2px solid transparent",
                      cursor: "pointer",
                      display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 12, alignItems: "center", color: "#fff",
                    }}>
                      <span className="num-en" style={{ color: "rgba(245,241,233,0.6)", fontSize: 12 }}>{c.t}</span>
                      <span style={{ fontSize: 14 }}>{c.title}</span>
                      {chapterIdx === i && <Icon name="play" size={12} />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 20, letterSpacing: "-0.025em", margin: 0 }}>My Notes · 학습 노트</h3>
                  <button className="btn btn-sm" style={{ background: "rgba(245,241,233,0.1)", color: "#fff", border: "1px solid rgba(245,241,233,0.18)" }} onClick={() => setShowNotes((s) => !s)}>{showNotes ? "감추기" : "보기"}</button>
                </div>
                {showNotes && (
                  <div>
                    <textarea
                      defaultValue={"좌극한·우극한이 같으면 극한이 존재한다. (예제 2 다시 풀어볼 것 ─ 풀이 시간 8분)\n\n‘연속이지만 미분불가능’ — 절댓값 함수의 꼭짓점.\n→ Q. 그러면 ‘미분불가능이지만 적분 가능’도 가능? (선생님께 질문)"}
                      style={{
                        width: "100%", minHeight: 200, background: "rgba(245,241,233,0.05)",
                        color: "#fff", border: "1px solid rgba(245,241,233,0.18)",
                        borderRadius: "var(--rj-r-sm)", padding: 14, fontSize: 14, lineHeight: 1.7,
                        outline: "none", resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "rgba(245,241,233,0.5)" }}>자동 저장됨 · 1초 전</span>
                      <button className="btn btn-accent btn-sm">노트 내보내기</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lesson list sidebar */}
        <aside style={{ background: "#0a0a0a", borderLeft: "1px solid rgba(245,241,233,0.1)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 72px)" }}>
          <div style={{ padding: 20, borderBottom: "1px solid rgba(245,241,233,0.1)" }}>
            <div className="eyebrow" style={{ color: "rgba(245,241,233,0.5)" }}>Lessons · 강의 목록</div>
            <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 18, marginTop: 8, letterSpacing: "-0.025em" }}>{course.title}</div>
            <div style={{ fontSize: 12, color: "rgba(245,241,233,0.5)", marginTop: 4 }}>
              <span className="num-en">{Math.round(((activeLesson + progress) / lessons.length) * 100)}%</span> 완료 · {activeLesson + 1} / {lessons.length} 강
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
            {lessons.map((l, i) => (
              <button key={l.id} onClick={() => { setActiveLesson(i); setProgress(0); setPlaying(true); }} style={{
                width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: "var(--rj-r-sm)",
                background: i === activeLesson ? "rgba(251,244,189,0.1)" : "transparent",
                border: i === activeLesson ? "1px solid rgba(251,244,189,0.3)" : "1px solid transparent",
                marginBottom: 4, cursor: "pointer", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", color: "#fff",
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(245,241,233,0.3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "var(--font-en)",
                  background: i < activeLesson ? "var(--rj-accent)" : "transparent",
                  color: i < activeLesson ? "var(--rj-ink)" : "rgba(245,241,233,0.6)",
                  borderColor: i < activeLesson ? "var(--rj-accent)" : "rgba(245,241,233,0.3)",
                }}>
                  {i < activeLesson ? <Icon name="check" size={10} /> : (i === activeLesson ? <Icon name="play" size={9} /> : String(i + 1).padStart(2, "0"))}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: i === activeLesson ? 600 : 400, lineHeight: 1.4 }}>{l.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(245,241,233,0.5)", marginTop: 3 }}>{l.weekUnit} · {l.duration}</div>
                </div>
                <span className="tag" style={{ borderColor: "rgba(245,241,233,0.2)", color: "rgba(245,241,233,0.7)", fontSize: 9, height: 18, padding: "0 6px" }}>{l.type === "live" ? "LIVE" : "VOD"}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────────────────────────
// 쇼케이스 플레이어 — Vimeo 쇼케이스(여러 강의) 임베드
// ──────────────────────────────────────────────────────────────────
function ShowcasePlayer({ course, ins, access, onBack }) {
  const iframeRef = useRefP(null);
  const goFull = () => {
    const el = iframeRef.current;
    if (!el) return;
    const req = el.requestFullscreen
      || el.webkitRequestFullscreen
      || el.webkitEnterFullscreen   // iOS Safari
      || el.mozRequestFullScreen
      || el.msRequestFullscreen;
    if (req) {
      try { req.call(el); }
      catch (e) { window.open(window.showcaseUrl(course.showcaseId), "_blank"); }
    } else {
      window.open(window.showcaseUrl(course.showcaseId), "_blank");
    }
  };

  if (!access) {
    return (
      <div style={{ minHeight: "calc(100vh - 72px)", background: "#000", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
        불러오는 중…
      </div>
    );
  }
  const badge = access.reason === "subscriber" ? "✓ 구독중 — 무제한 시청"
    : access.reason === "purchased" ? "✓ 수강 중인 강의"
    : access.reason === "enrolled" ? "✓ 수강생 무료 다시보기"
    : access.reason === "staff" ? "관리자 미리보기"
    : access.reason === "free" ? "무료 공개" : "시청 가능";
  return (
    <div className="page-enter" style={{ background: "#000", color: "var(--rj-paper)", minHeight: "calc(100vh - 72px)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }} onClick={onBack}>
            <Icon name="arrowLeft" size={14} /> 강의 소개
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 999 }}>{badge}</span>
            <button className="btn btn-sm" style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }} onClick={goFull} title="전체화면 (Esc로 해제)">
              <span style={{ fontSize: 13, marginRight: 4 }}>⛶</span> 전체화면
            </button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 30, letterSpacing: "-0.03em", margin: 0 }}>{course.title}</h1>
          <span style={{ fontSize: 13.5, color: "rgba(245,241,233,0.6)" }}>{ins?.name}{course.level ? " · " + course.level : ""}</span>
        </div>
        <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "#0c0c0c", position: "relative" }}>
          <iframe
            ref={iframeRef}
            title={course.title}
            src={window.showcaseEmbedSrc(course.showcaseId)}
            style={{ width: "100%", height: "74vh", minHeight: 460, border: 0, display: "block" }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            webkitallowfullscreen=""
            mozallowfullscreen=""
          />
        </div>
        <p style={{ fontSize: 12.5, color: "rgba(245,241,233,0.5)", marginTop: 14, lineHeight: 1.7 }}>
          강의 목록·순서는 Vimeo 쇼케이스를 따릅니다 · 목록에서 강의를 선택해 이어 시청하세요 · <strong style={{ color: "rgba(245,241,233,0.75)" }}>전체화면</strong>은 우상단 버튼 또는 영상 우하단의 Vimeo 전체화면 아이콘으로 진입할 수 있습니다 (Esc로 해제).
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// STEP4: 실제 등록된 차시(lessons) 기반 플레이어 — 관리자가 STEP3에서 강좌별로 저장한
// 여러 개의 단일 Vimeo 영상을 1강, 2강… 순서로 재생한다. lessons 는 vod_get_student_lessons
// (서버)가 이미 실제 권한을 검증한 뒤 넘겨준 값만 사용하며, course_id 변조 등은 그 쪽에서 막힌다.
// PC: 플레이어 + 우측 차시 목록 / 모바일: 플레이어 아래 차시 목록(.rj-lessons-layout, shared/site.css)
// ──────────────────────────────────────────────────────────────────
function LessonsPlayer({ course, ins, lessons, reason, onBack }) {
  const [activeIdx, setActiveIdx] = useStateP(0);
  const active = lessons[activeIdx] || lessons[0];

  const badge = reason === "subscriber" ? "✓ 구독중 — 무제한 시청"
    : reason === "purchased" ? "✓ 구매한 강의"
    : reason === "enrolled" ? "✓ 수강생 무료 다시보기"
    : reason === "staff" ? "관리자 미리보기"
    : reason === "free" ? "무료 공개" : "시청 가능";

  return (
    <div className="page-enter" style={{ background: "#000", color: "var(--rj-paper)", minHeight: "calc(100vh - 72px)" }}>
      <div className="rj-lessons-layout">
        {/* Player + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", background: "#0c0c0c", aspectRatio: "16 / 9" }}>
            {active && active.vimeo_id ? (
              <iframe
                key={active.id}
                title={active.title}
                src={window.videoEmbedSrc(active.vimeo_id, active.vimeo_hash)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                이 차시에는 아직 영상이 연결되지 않았습니다
              </div>
            )}
            <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn btn-sm" style={{ background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }} onClick={onBack}>
                <Icon name="arrowLeft" size={14} /> {course.title}
              </button>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, backdropFilter: "blur(8px)" }}>{badge}</span>
            </div>
          </div>

          <div style={{ padding: 28, color: "var(--rj-paper)" }}>
            <div className="eyebrow" style={{ color: "rgba(245,241,233,0.5)" }}>
              {String(activeIdx + 1).padStart(2, "0")}강 / {lessons.length}강
            </div>
            <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 28, letterSpacing: "-0.025em", margin: "10px 0 6px" }}>{active ? active.title : course.title}</h1>
            <div style={{ fontSize: 14, color: "rgba(245,241,233,0.6)" }}>{ins?.name} · {course.title}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-sm" style={{ background: "rgba(245,241,233,0.1)", color: "#fff", border: "1px solid rgba(245,241,233,0.18)" }}
                disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}>
                <Icon name="arrowLeft" size={14} /> 이전 강의
              </button>
              <button className="btn btn-sm" style={{ background: "rgba(245,241,233,0.1)", color: "#fff", border: "1px solid rgba(245,241,233,0.18)" }}
                disabled={activeIdx >= lessons.length - 1} onClick={() => setActiveIdx((i) => Math.min(lessons.length - 1, i + 1))}>
                다음 강의 <Icon name="arrow" size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 차시 목록 (PC: 우측 / 모바일: 플레이어 아래) */}
        <aside className="rj-lessons-sidebar" style={{ background: "#0a0a0a", borderLeft: "1px solid rgba(245,241,233,0.1)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 20, borderBottom: "1px solid rgba(245,241,233,0.1)" }}>
            <div className="eyebrow" style={{ color: "rgba(245,241,233,0.5)" }}>차시 목록</div>
            <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 18, marginTop: 8, letterSpacing: "-0.025em" }}>{course.title}</div>
          </div>
          <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
            {lessons.map((l, i) => (
              <button key={l.id} onClick={() => setActiveIdx(i)} style={{
                width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: "var(--rj-r-sm)",
                background: i === activeIdx ? "rgba(251,244,189,0.1)" : "transparent",
                border: i === activeIdx ? "1px solid rgba(251,244,189,0.3)" : "1px solid transparent",
                marginBottom: 4, cursor: "pointer", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", color: "#fff",
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: "50%", border: "1px solid rgba(245,241,233,0.3)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontFamily: "var(--font-en)",
                  background: i === activeIdx ? "var(--rj-accent)" : "transparent",
                  color: i === activeIdx ? "var(--rj-ink)" : "rgba(245,241,233,0.6)",
                  borderColor: i === activeIdx ? "var(--rj-accent)" : "rgba(245,241,233,0.3)",
                }}>
                  {i === activeIdx ? <Icon name="play" size={9} /> : String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: i === activeIdx ? 600 : 400, lineHeight: 1.4 }}>{i + 1}강 · {l.title}</div>
                  <div style={{ fontSize: 11, color: "rgba(245,241,233,0.5)", marginTop: 3 }}>{l.duration_sec ? fmtTime(l.duration_sec) : "재생시간 미등록"}</div>
                </div>
                {i === activeIdx && <span className="tag" style={{ borderColor: "rgba(251,244,189,0.4)", color: "var(--rj-accent)", fontSize: 9, height: 18, padding: "0 6px" }}>재생중</span>}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// /live — listing
// /live/:id — entry to live classroom
// ──────────────────────────────────────────────────────────────────
function LivePage({ courseId }) {
  const { navigate } = useApp();
  if (courseId) {
    const course = findCourse(courseId);
    if (course) {
      // VOD 전용 강좌(쇼케이스/단일 영상 연결됨)는 라이브 강의실이 아닌 플레이어로
      if (course.showcaseId || course.vimeoId) {
        useEffectP(() => { navigate("/player/" + course.id); }, []);
        return null;
      }
      return <LiveEntry course={course} />;
    }
  }
  return <LiveSchedule />;
}

function LiveSchedule() {
  const { navigate } = useApp();
  // 실제 라이브 강좌가 등록되면 강의 관리에서 자동으로 표시됩니다.
  // 데모(미적분/문학·독서/구문독해) 콘텐츠 제거됨.
  return (
    <div className="page-enter">
      <section style={{ background: "var(--rj-ink)", color: "var(--rj-paper)", padding: "56px 0" }}>
        <div className="container-wide">
          <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>Live · 리뉴젠 라이브 강의실</div>
          <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 72, letterSpacing: "-0.035em", margin: "16px 0 0", lineHeight: 0.98 }}>
            오늘의 라이브, <span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300 }}>now on air.</span>
          </h1>
          <p className="body-lg" style={{ color: "rgba(245,241,233,0.7)", marginTop: 18, maxWidth: 580 }}>
            모든 라이브는 리뉴젠 자체 강의실에서 진행됩니다. 강의 시작 10분 전부터 입장 버튼이 활성화됩니다.
          </p>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 80, paddingBottom: 96 }}>
        <div style={{ textAlign: "center", padding: "80px 24px", border: "1px dashed var(--rj-line)", borderRadius: "var(--rj-r)" }}>
          <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 30, letterSpacing: "-0.025em", color: "var(--rj-ink)" }}>예정된 라이브가 없습니다.</div>
          <p className="body-lg" style={{ color: "var(--rj-muted)", marginTop: 16, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
            라이브 일정이 등록되면 여기에서 확인할 수 있습니다. 다시보기는 마이페이지의 ‘회원 전용 강의’에서 시청할 수 있습니다.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/courses")}>강의 둘러보기 <Icon name="arrow" size={14} /></button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate("/mypage")}>마이페이지</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LiveEntry({ course }) {
  const { navigate, route, user } = useApp();
  // Support ?join=1 query — skip preflight and jump straight into the room
  const wantsJoin = route?.params?.get?.("join") === "1";
  const [phase, setPhase] = useStateP(wantsJoin ? "live" : "preflight"); // preflight | live
  const [mic, setMic] = useStateP(true);
  const [cam, setCam] = useStateP(false);
  const ins = findInstructor(course.instructor);
  const [joining, setJoining] = useStateP(false);

  // 실제 라이브 강의실 — 사이트 안에서 구동
  if (phase === "live") {
    return <window.LiveRoom course={course} onEnd={() => navigate("/player/" + course.id)} />;
  }

  return (
    <div className="page-enter">
      <section style={{ background: "var(--rj-ink)", color: "var(--rj-paper)", padding: "48px 0 96px" }}>
        <div className="container">
          <button className="btn-link" onClick={() => navigate("/live")} style={{ color: "rgba(245,241,233,0.7)", fontSize: 13, textDecoration: "none" }}><Icon name="arrowLeft" size={14} /> 라이브 목록</button>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 56, marginTop: 32, alignItems: "start" }}>
            {/* Preview / device check */}
            <div>
              <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>Pre-Flight Check · 입장 준비</div>
              <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 48, letterSpacing: "-0.03em", margin: "14px 0 8px", lineHeight: 1.05 }}>
                라이브 강의실 입장
              </h1>
              <div style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontSize: 18, color: "rgba(245,241,233,0.7)" }}>You'll be in the room in a moment.</div>

              <div className="card" style={{ background: "rgba(245,241,233,0.04)", border: "1px solid rgba(245,241,233,0.15)", marginTop: 28, padding: 24, color: "var(--rj-paper)", borderRadius: "var(--rj-r)" }}>
                {/* Camera preview */}
                <div style={{ aspectRatio: "16/9", background: "#0a0a0a", border: "1px solid rgba(245,241,233,0.1)", borderRadius: "var(--rj-r-sm)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, position: "relative" }}>
                  <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.1 }} />
                  {cam ? (
                    <>
                      <span className="avatar avatar-xl" style={{ background: "rgba(245,241,233,0.1)", color: "var(--rj-paper)", border: "1px solid rgba(245,241,233,0.18)" }}>{((user && user.name) || "나").slice(0, 1)}</span>
                      <div style={{ fontSize: 13, color: "rgba(245,241,233,0.7)" }}>카메라 활성 — 좌우 반전 미리보기</div>
                    </>
                  ) : (
                    <>
                      <Icon name="eye" size={28} className="" />
                      <div style={{ fontSize: 13, color: "rgba(245,241,233,0.6)" }}>카메라가 꺼져 있습니다</div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "center" }}>
                  <button onClick={() => setMic((m) => !m)} className="btn btn-circle" style={{ background: mic ? "var(--rj-accent)" : "rgba(245,241,233,0.1)", color: mic ? "var(--rj-ink)" : "var(--rj-paper)", width: 52, height: 52, border: mic ? "none" : "1px solid rgba(245,241,233,0.2)" }}>
                    <Icon name="mic" size={20} />
                  </button>
                  <button onClick={() => setCam((c) => !c)} className="btn btn-circle" style={{ background: cam ? "var(--rj-accent)" : "rgba(245,241,233,0.1)", color: cam ? "var(--rj-ink)" : "var(--rj-paper)", width: 52, height: 52, border: cam ? "none" : "1px solid rgba(245,241,233,0.2)" }}>
                    <Icon name="eye" size={20} />
                  </button>
                  <button className="btn btn-circle" style={{ background: "rgba(245,241,233,0.1)", color: "var(--rj-paper)", width: 52, height: 52, border: "1px solid rgba(245,241,233,0.2)" }}>
                    <Icon name="sparkle" size={20} />
                  </button>
                </div>

                <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(245,241,233,0.1)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, fontSize: 13 }}>
                  <div>
                    <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>Microphone</div>
                    <div style={{ marginTop: 4 }}>{mic ? "마이크 켜짐" : "마이크 꺼짐"}</div>
                  </div>
                  <div>
                    <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>Camera</div>
                    <div style={{ marginTop: 4 }}>{cam ? "카메라 켜짐" : "카메라 꺼짐"}</div>
                  </div>
                  <div>
                    <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>Network</div>
                    <div style={{ marginTop: 4, color: "#7BCB8C" }}>● 연결됨</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Room info */}
            <div>
              <div className="card" style={{ background: "rgba(245,241,233,0.04)", border: "1px solid rgba(245,241,233,0.15)", padding: 28, color: "var(--rj-paper)", borderRadius: "var(--rj-r)" }}>
                <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>Renewjen Live Room · 강의실</div>
                <div className="num-en" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.08em", marginTop: 8 }}>{course.classInRoomId}</div>
                <div style={{ height: 1, background: "rgba(245,241,233,0.1)", margin: "20px 0" }} />

                <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 26, letterSpacing: "-0.025em", lineHeight: 1.2 }}>{course.title}</div>
                <div style={{ fontSize: 14, color: "rgba(245,241,233,0.7)", marginTop: 6 }}>{ins?.name} · {course.level}</div>

                <div style={{ marginTop: 24, padding: 20, background: "rgba(251,244,189,0.08)", borderRadius: "var(--rj-r-sm)", border: "1px solid rgba(251,244,189,0.2)" }}>
                  <div className="label-cap" style={{ color: "rgba(251,244,189,0.7)" }}>곧 입장할 수 있습니다</div>
                  <div style={{ fontSize: 13, color: "rgba(245,241,233,0.7)", marginTop: 8 }}>정확한 라이브 일정은 강의 소개 페이지에서 확인해주세요.</div>
                </div>

                <ul style={{ marginTop: 24, padding: 0, listStyle: "none", display: "grid", gap: 10, fontSize: 13, color: "rgba(245,241,233,0.85)" }}>
                  {[
                    "마이크와 카메라 사용을 허용해주세요.",
                    "수업 중 채팅과 손들기로 질문할 수 있습니다.",
                    "수업은 자동 녹화되어 5분 안에 다시보기로 업로드됩니다.",
                  ].map((t, i) => (
                    <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <Icon name="check" size={14} className="" /> <span>{t}</span>
                    </li>
                  ))}
                </ul>

                <button
                  className="btn btn-accent btn-lg btn-block"
                  style={{ marginTop: 24, height: 60, fontSize: 16 }}
                  onClick={async () => {
                    setJoining(true);
                    const r = await window.classinEnter({ uid: "", courseId: course.classInCourseId || course.id, classId: course.classInRoomId });
                    if (r.ok && r.url) { window.location.href = r.url; return; }
                    // 백엔드 미배포 → 사이트 내 강의실로 진입
                    setTimeout(() => setPhase("live"), 600);
                  }}
                  disabled={joining}
                >
                  {joining ? "라이브 강의실 입장 중…" : <><Icon name="live" size={16} /> 실시간 수업 입장</>}
                </button>
                <div style={{ marginTop: 12, fontSize: 11, color: "rgba(245,241,233,0.5)", textAlign: "center", fontFamily: "var(--font-en)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Renewjen Live Classroom · 자체 운영
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

window.PlayerPage = PlayerPage;
window.LivePage = LivePage;
