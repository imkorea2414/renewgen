/* global React, COURSES, INSTRUCTORS, SUBJECTS, REVIEWS, useApp, Icon, CoursePoster, CourseRowCard, SectionHead, findInstructor, findCourse, findSubject, formatKRW, ACCOUNT */

const { useState: useStateC, useMemo: useMemoC, useEffect: useEffectC } = React;

// ──────────────────────────────────────────────────────────────────
// /courses — list with filters
// ──────────────────────────────────────────────────────────────────
function CoursesPage() {
  const { navigate } = useApp();
  const [subject, setSubject] = useStateC("all");
  const [level, setLevel] = useStateC("all");
  const [sort, setSort] = useStateC("popular");
  const [query, setQuery] = useStateC("");

  const filtered = useMemoC(() => {
    // 공개 메뉴에는 "전체공개(샘플)" 강의만 노출 · "회원전용(진짜)" 강의는 로그인 대시보드에서만
    let xs = (window.publicCourses ? window.publicCourses() : COURSES).slice();
    if (subject !== "all") xs = xs.filter((c) => c.subject === subject);
    if (level !== "all") xs = xs.filter((c) => c.level.includes(level));
    if (query) xs = xs.filter((c) => (c.title + c.subtitle).toLowerCase().includes(query.toLowerCase()));
    if (sort === "popular") xs.sort((a, b) => b.enrolled - a.enrolled);
    if (sort === "newest")  xs.sort((a, b) => a.no.localeCompare(b.no));
    if (sort === "rating")  xs.sort((a, b) => b.rating - a.rating);
    if (sort === "priceAsc")  xs.sort((a, b) => a.salePrice - b.salePrice);
    return xs;
  }, [subject, level, query, sort]);

  const levels = ["all", "중A", "중B", "고A", "고B", "고C", "입문", "중급", "실전"];
  const subjectFilters = [
    { id: "all", ko: "전과목" },
    { id: "korean", ko: "국어" },
    { id: "math", ko: "수학" },
    { id: "english", ko: "영어" },
    { id: "social", ko: "사회" },
    { id: "science", ko: "과학" },
    { id: "toefl", ko: "토플" },
    { id: "toeic", ko: "토익" },
  ].filter((s) => !(window.RJ_EDU_MODE && (s.id === "toefl" || s.id === "toeic")));

  return (
    <div className="page-enter">
      {/* Header band */}
      <section style={{ borderBottom: "1px solid var(--rj-faint)" }}>
        <div className="container-wide" style={{ paddingTop: 48, paddingBottom: 36 }}>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>All Courses · 전체 강의</div>
          <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 64, letterSpacing: "-0.03em", margin: "16px 0 0", lineHeight: 1 }}>
            강의 라인업, <span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300 }}>by season.</span>
          </h1>
          <p className="body-lg" style={{ color: "var(--rj-muted)", marginTop: 18, maxWidth: 640 }}>
            {eduText("실시간 라이브 + 다시보기 + 첨삭 — 모든 강의가 같은 구성으로 짜여 있습니다.", "녹화 강의 + 다시보기 + 첨삭 — 모든 강의가 같은 구성으로 짜여 있습니다.")}
          </p>
        </div>
      </section>

      {/* Filters bar */}
      <section className="container-wide" style={{ paddingTop: 28, paddingBottom: 28, position: "sticky", top: 72, background: "var(--rj-paper)", zIndex: 10, borderBottom: "1px solid var(--rj-faint)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 24, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {subjectFilters.map((s) => (
              <FilterChip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>{s.ko}</FilterChip>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {levels.map((lv) => (
              <FilterChip key={lv} active={level === lv} onClick={() => setLevel(lv)}>{lv === "all" ? "전체 레벨" : lv}</FilterChip>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <Icon name="search" size={16} className="" />
            <input className="input" style={{ width: 220, paddingLeft: 36 }} placeholder="강의 검색"
                   value={query} onChange={(e) => setQuery(e.target.value)} />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--rj-muted)" }}><Icon name="search" size={16} /></span>
          </div>
          <select className="input" style={{ width: 140 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">인기순</option>
            <option value="newest">신규순</option>
            <option value="rating">평점순</option>
            <option value="priceAsc">가격낮은순</option>
          </select>
        </div>
      </section>

      {/* Result count + view toggle */}
      <section className="container-wide" style={{ paddingTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "var(--rj-muted)" }}>
            <span className="num-en" style={{ color: "var(--rj-ink)", fontWeight: 600 }}>{filtered.length}</span>개의 강의
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, paddingBottom: 80 }}>
          {filtered.map((c) => (
            <CourseRowCard key={c.id} course={c} onOpen={() => navigate("/courses/" + c.id)} />
          ))}
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: 80, color: "var(--rj-muted)" }}>해당하는 강의가 없습니다</div>}
        </div>
      </section>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className="chip" style={{
      background: active ? "var(--rj-ink)" : "transparent",
      color: active ? "var(--rj-paper)" : "var(--rj-ink)",
      borderColor: active ? "var(--rj-ink)" : "var(--rj-faint)",
      height: 32,
      padding: "0 14px",
      cursor: "pointer",
    }}>{children}</button>
  );
}

function CourseMetaUnderPoster({ course }) {
  const ins = findInstructor(course.instructor);
  return (
    <div>
      <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 18, letterSpacing: "-0.025em", lineHeight: 1.25 }}>{course.title}</div>
      <div style={{ fontSize: 12, color: "var(--rj-muted)", marginTop: 4 }}>{ins?.name} · {course.lessons}강</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
        <span className="num-en" style={{ fontWeight: 600, fontSize: 16 }}>{formatKRW(course.salePrice)}</span>
        <span style={{ fontSize: 11, color: "var(--rj-muted)" }}><Icon name="star" size={10} /> <span className="num-en">{course.rating}</span> ({course.reviews})</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// /courses/:id — detail
// ──────────────────────────────────────────────────────────────────
function CourseDetailPage({ courseId }) {
  const { navigate, addToCart, user, cart, showToast } = useApp();
  const course = findCourse(courseId);
  const ins = course ? findInstructor(course.instructor) : null;
  const [tab, setTab] = useStateC("curriculum");
  const owned = user && ACCOUNT.enrolled.includes(courseId);
  const inCart = cart.some((c) => c.courseId === courseId);
  const reviews = REVIEWS.filter((r) => r.courseId === courseId);

  if (!course) {
    return (
      <div className="container" style={{ padding: "120px 0", textAlign: "center" }}>
        <h2>강의를 찾을 수 없습니다.</h2>
        <button className="btn btn-primary" onClick={() => navigate("/courses")} style={{ marginTop: 24 }}>강의 목록으로</button>
      </div>
    );
  }

  // publicCourses()(courses-store.jsx)와 동일한 기준 — "실제 VOD 콘텐츠(쇼케이스/단일 영상/lessons)를
  // 가진 강좌인가"를 문자열(format 등) 판정 없이 실데이터로 판정한다. LIVE 데모 강좌는 셋 다 없어 false.
  const isVodCourse = !!(course.showcaseId || course.vimeoId || Number(course.lessons || 0) > 0);

  return (
    <div className="page-enter">
      {/* Hero */}
      <section style={{ background: "var(--rj-ink)", color: "var(--rj-paper)", padding: "56px 0 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(assets/photos/p12.jpg)", backgroundSize: "cover", backgroundPosition: "center 28%", opacity: 0.2 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(92deg, rgba(10,12,14,0.92) 0%, rgba(10,12,14,0.72) 60%, rgba(10,12,14,0.5) 100%)" }} />
        <div className="container-wide" style={{ position: "relative" }}>
          <button className="btn-link" onClick={() => navigate("/courses")} style={{ color: "rgba(245,241,233,0.7)", fontSize: 13, textDecoration: "none" }}><Icon name="arrowLeft" size={14} /> 전체 강의</button>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 64, marginTop: 32, alignItems: "stretch" }}>
            <div>
              <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>No. {course.no} · {findSubject(course.subject)?.en}</div>
              <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: "clamp(48px, 6vw, 92px)", letterSpacing: "-0.03em", lineHeight: 1.02, margin: "20px 0 6px" }}>
                {course.title}
              </h1>
              <div style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 24, color: "rgba(245,241,233,0.7)" }}>{course.subtitle}</div>
              <p className="body-lg" style={{ marginTop: 24, maxWidth: 580, color: "rgba(245,241,233,0.85)" }}>{course.description}</p>

              <div style={{ display: "flex", gap: 24, marginTop: 36, paddingTop: 24, borderTop: "1px solid rgba(245,241,233,0.18)", flexWrap: "wrap" }}>
                {[
                  ["FORMAT", course.format],
                  ...(isVodCourse ? [] : [["WEEKS", course.weeks + " weeks"]]),
                  ["LESSONS", course.lessons + " 강"],
                  ["LEVEL",  course.level],
                  ["LANGUAGE", "한국어"],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>{l}</div>
                    <div style={{ marginTop: 4, fontSize: 15 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview / instructor card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div onClick={() => navigate("/player/" + course.id)} style={{ position: "relative", aspectRatio: "16/10", background: "#000", borderRadius: "var(--rj-r)", overflow: "hidden", border: "1px solid rgba(245,241,233,0.18)", cursor: "pointer" }}>
                <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.18 }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                  <button className="btn-circle" style={{ width: 72, height: 72, background: "var(--rj-accent)", color: "var(--rj-ink)" }} onClick={() => navigate("/player/" + course.id)}>
                    <Icon name="play" size={28} />
                  </button>
                  <div style={{ fontFamily: "var(--font-en)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(245,241,233,0.8)" }}>강의 보기</div>
                </div>
                <span className="chip" style={{ position: "absolute", top: 14, left: 14, background: "rgba(0,0,0,0.6)", color: "var(--rj-paper)", borderColor: "transparent", backdropFilter: "blur(6px)" }}>강의 재생</span>
              </div>
              <div style={{ border: "1px solid rgba(245,241,233,0.18)", borderRadius: "var(--rj-r)", padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
                <span className="avatar avatar-lg" style={{ background: "var(--rj-paper)", color: "var(--rj-ink)" }}>{ins?.initials}</span>
                <div style={{ flex: 1 }}>
                  <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>Instructor</div>
                  <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 22, marginTop: 4, letterSpacing: "-0.025em" }}>{ins?.name}</div>
                  <div style={{ fontSize: 13, color: "rgba(245,241,233,0.7)", marginTop: 4 }}>{ins?.title}</div>
                </div>
                <button className="btn btn-sm" style={{ background: "transparent", border: "1px solid rgba(245,241,233,0.4)", color: "var(--rj-paper)" }} onClick={() => navigate("/instructors/" + ins?.id)}>강사 소개 →</button>
              </div>
            </div>
          </div>

          {/* Sticky purchase bar - bottom of hero */}
          <div style={{
            marginTop: 48,
            marginBottom: -28,
            background: "var(--rj-paper)",
            color: "var(--rj-ink)",
            borderRadius: "var(--rj-r)",
            padding: 24,
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 24,
            alignItems: "center",
          }}>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span style={{ background: "var(--rj-accent)", color: "var(--rj-ink)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>구독 시 무료</span>
                <span className="num-en" style={{ fontSize: 14, color: "var(--rj-muted)" }}>다시보기 단건</span>
                <span className="num-en" style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>{formatKRW(course.recordingPrice || course.salePrice)}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--rj-muted)", marginTop: 4 }}>월정액 구독자는 모든 녹화본 무료 · 비구독자는 강의별 구매</div>
            </div>
            <div style={{ fontSize: 13, color: "var(--rj-muted)", display: "flex", gap: 18, justifyContent: "center" }}>
              <span><Icon name="check" size={14} /> 라이브 + VOD</span>
              <span><Icon name="check" size={14} /> 평생 다시보기</span>
              <span><Icon name="check" size={14} /> Vimeo 보안재생</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {owned ? (
                <button className="btn btn-primary btn-lg" onClick={() => navigate("/player/" + course.id)}><Icon name="play" size={16} /> 이어보기</button>
              ) : (
                <>
                  <button className="btn btn-ghost btn-lg" onClick={() => navigate("/subscribe")}>
                    <Icon name="star" size={16} /> 구독하기
                  </button>
                  <button className="btn btn-primary btn-lg" onClick={() => navigate("/player/" + course.id)}>다시보기 구매 <Icon name="arrow" size={16} /></button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Spacer for sticky bar overlap */}
      <div style={{ height: 56 }} />

      {/* Tabs */}
      <section className="container-wide">
        <div style={{ borderBottom: "1px solid var(--rj-line)", display: "flex", gap: 32 }}>
          {[
            ["curriculum", "커리큘럼", "Curriculum"],
            ["includes",   "포함 사항", "What's Included"],
            ["instructor", "강사 소개", "Instructor"],
            ["reviews",    "수강 후기", "Reviews"],
            ["faq",        "FAQ", "Q&A"],
          ].map(([k, ko, en]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "20px 0",
              borderBottom: tab === k ? "2px solid var(--rj-ink)" : "2px solid transparent",
              marginBottom: -1,
              fontSize: 15,
              fontWeight: tab === k ? 600 : 400,
              color: tab === k ? "var(--rj-ink)" : "var(--rj-muted)",
            }}>
              {ko} <span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 12, marginLeft: 4 }}>{en}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: "48px 0 96px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 48 }}>
          <div>
            {tab === "curriculum" && <Curriculum course={course} owned={owned} onPlay={() => navigate("/player/" + course.id)} />}
            {tab === "includes"   && <Includes course={course} />}
            {tab === "instructor" && <InstructorBlock ins={ins} onMore={() => navigate("/instructors/" + ins.id)} />}
            {tab === "reviews"    && <ReviewsBlock reviews={reviews} rating={course.rating} totalReviews={course.reviews} />}
            {tab === "faq"        && <FAQBlock />}
          </div>
          <aside>
            <div className="card" style={{ padding: 24, position: "sticky", top: 160 }}>
              {isVodCourse ? (
                <>
                  <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>강의 수강</div>
                  <div style={{ marginTop: 14, fontFamily: "var(--font-kr-serif)", fontSize: 22, letterSpacing: "-0.025em" }}>
                    VOD 전용 강의
                  </div>
                </>
              ) : (
                <>
                  <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Next Live · 다음 라이브</div>
                  <div style={{ marginTop: 14, fontFamily: "var(--font-kr-serif)", fontSize: 22, letterSpacing: "-0.025em" }}>
                    {course.nextLive ? new Date(course.nextLive).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" }) : "—"}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--rj-muted)", marginTop: 4 }}>
                    {course.nextLive ? new Date(course.nextLive).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) + " · 강의실 " + course.classInRoomId : "VOD 전용 강의"}
                  </div>
                </>
              )}
              {course.nextLive && !(course.showcaseId || course.vimeoId) && (
                <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={() => navigate("/live/" + course.id)}>
                  <Icon name="live" size={14} /> 실시간 수업 입장
                </button>
              )}
              {(course.showcaseId || course.vimeoId) && (
                <button className="btn btn-primary btn-block" style={{ marginTop: 18 }} onClick={() => navigate("/player/" + course.id)}>
                  <Icon name="play" size={14} /> 강의 보기
                </button>
              )}
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--rj-faint)" }}>
                <div className="label-cap" style={{ color: "var(--rj-muted)", marginBottom: 12 }}>공유</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-soft btn-sm" style={{ flex: 1 }} onClick={() => showToast("링크가 복사되었습니다")}>링크 복사</button>
                  <button className="btn btn-soft btn-sm" style={{ flex: 1 }}>카카오톡</button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

    </div>
  );
}

// 강좌 소개 페이지의 "커리큘럼" 탭 — 강좌 종류에 따라 셋 중 하나로 분기한다.
//   A. lessons(실제 VOD 차시)가 있는 강좌 → VodLessonsCurriculum (공개 커리큘럼 RPC 기반)
//   B. lessons는 없지만 기존 주차형 syllabus가 있는 강좌(LIVE) → LiveCurriculum (기존 그대로)
//   C. 둘 다 없는 레거시(showcase 전용 등) → CurriculumComingSoon
// "16주 커리큘럼" 같은 라이브 전용 문구는 A/C 어느 쪽에서도 노출되지 않는다.
function Curriculum({ course, owned, onPlay }) {
  const hasLessons = Number(course.lessons || 0) > 0;
  if (hasLessons) return <VodLessonsCurriculum course={course} />;
  if (course.syllabus && course.syllabus.length > 0) return <LiveCurriculum course={course} owned={owned} onPlay={onPlay} />;
  return <CurriculumComingSoon />;
}

// 커리큘럼 화면 표시용 — 반복되는 강좌명 접두사("[온택 검정고시] 중졸과학" 등, 표기가 제각각이라
// 접두사 자체를 정규식으로 매칭하지 않는다)를 지우고 "N강"부터 보여준다. DB의 title 원본은 건드리지
// 않고 렌더링 시점에만 자른다. "N강" 패턴을 못 찾으면 원본을 그대로 보여준다(안전 폴백).
function stripCurriculumTitlePrefix(title) {
  const t = String(title || "");
  const m = t.match(/\d{1,3}\s*강/);
  return m ? t.slice(m.index) : t;
}

// 사람이 읽기 쉬운 길이 표기 — "9분 39초" / "47초"
function formatDurationKo(sec) {
  const s = Math.floor(Number(sec) || 0);
  if (s <= 0) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}분 ${r}초` : `${r}초`;
}

// STEP: 강좌 상세페이지 커리큘럼 공개 — 실제 재생에 필요한 vimeo_id/hash 는 전혀 다루지 않는다.
//   vod_get_course_curriculum(공개 RPC)는 order_index/title/duration_sec 만 반환하며,
//   실제 재생 권한 검증(vod_get_student_lessons)은 PlayerPage 에서만 그대로 수행된다(이 컴포넌트는 관여 안 함).
//   28/29/30차시처럼 같은 Vimeo 영상을 공유하는 차시도 RPC가 돌려준 lesson row 개수 그대로 표시한다
//   (vimeo_id 를 애초에 받지 않으므로 동영상 기준 중복 제거를 할 방법도, 이유도 없다).
function VodLessonsCurriculum({ course }) {
  const [phase, setPhase] = useStateC("loading"); // loading | success | empty | error
  const [items, setItems] = useStateC([]);

  useEffectC(() => {
    let alive = true;
    setPhase("loading");
    if (!window.vodFetchCourseCurriculum) { setPhase("error"); return; }
    window.vodFetchCourseCurriculum(course.id).then((r) => {
      if (!alive) return;
      if (!r || !r.ok) { setPhase("error"); return; }
      const lessons = (Array.isArray(r.lessons) ? r.lessons.slice() : [])
        .sort((a, b) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0));
      setItems(lessons);
      setPhase(lessons.length ? "success" : "empty");
    }).catch(() => { if (alive) setPhase("error"); });
    return () => { alive = false; };
  }, [course.id]);

  return (
    <div>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Syllabus · 커리큘럼 · {course.lessons}차시</div>
          <h2 style={{ marginTop: 10 }}>실제 강의 구성</h2>
        </div>
      </div>
      <p style={{ color: "var(--rj-muted)", margin: "0 0 24px", maxWidth: 720 }}>
        총 {course.lessons}개의 온라인 강의로 구성되어 있습니다.
      </p>

      {phase === "loading" && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--rj-muted)" }}>커리큘럼을 불러오는 중…</div>
      )}
      {phase === "error" && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--rj-muted)" }}>커리큘럼을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>
      )}
      {phase === "empty" && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--rj-muted)" }}>등록된 차시가 없습니다.</div>
      )}
      {phase === "success" && (
        <div style={{ border: "1px solid var(--rj-line)", borderRadius: "var(--rj-r)" }}>
          {items.map((l, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "16px 24px",
              borderTop: i === 0 ? "none" : "1px solid var(--rj-faint)",
            }}>
              <span className="num-en" style={{ fontSize: 12, letterSpacing: "0.14em", color: "var(--rj-muted)", fontWeight: 700, width: 64, flexShrink: 0 }}>{i + 1}차시</span>
              <span style={{ flex: 1, fontFamily: "var(--font-kr-serif)", fontSize: 15, letterSpacing: "-0.01em" }}>{stripCurriculumTitlePrefix(l.title)}</span>
              <span style={{ fontSize: 12.5, color: "var(--rj-muted)", flexShrink: 0 }}>{formatDurationKo(l.duration_sec)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 기존 주차형(LIVE) 커리큘럼 — Curriculum 이 하던 일을 이름만 바꿔 그대로 옮김(로직/JSX 변경 없음).
function LiveCurriculum({ course, owned, onPlay }) {
  const [open, setOpen] = useStateC(0);
  return (
    <div>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Syllabus · 16주 커리큘럼</div>
          <h2 style={{ marginTop: 10 }}>매주의 진도</h2>
        </div>
      </div>
      <p style={{ color: "var(--rj-muted)", margin: "0 0 24px", maxWidth: 720 }}>
        매 주차 라이브 강의 2회 + 다시보기 + 첨삭 1회로 구성. 1주차 OT는 모두에게 무료로 열려 있습니다.
      </p>
      <div style={{ border: "1px solid var(--rj-line)", borderRadius: "var(--rj-r)" }}>
        {course.syllabus.map((s, i) => (
          <div key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--rj-faint)" }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} style={{
              width: "100%", textAlign: "left", padding: "20px 24px", display: "grid",
              gridTemplateColumns: "80px 1fr auto auto", gap: 24, alignItems: "center", cursor: "pointer", background: "transparent",
            }}>
              <span className="num-en" style={{ fontSize: 12, letterSpacing: "0.14em", color: "var(--rj-muted)", fontWeight: 700 }}>{s.unit}</span>
              <span style={{ fontFamily: "var(--font-kr-serif)", fontSize: 19, letterSpacing: "-0.025em" }}>{s.title}</span>
              <span style={{ fontSize: 13, color: "var(--rj-muted)" }}>{s.lessons}강 · {s.duration}</span>
              <Icon name="chevronDown" size={18} className="" />
            </button>
            {open === i && (
              <div style={{ padding: "0 24px 20px 128px", display: "grid", gap: 10 }}>
                {Array.from({ length: s.lessons }, (_, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: "1px solid var(--rj-faint)" }}>
                    <span style={{ fontFamily: "var(--font-en)", fontSize: 11, color: "var(--rj-muted)", width: 32 }}>{String(j + 1).padStart(2, "0")}</span>
                    <span style={{ flex: 1, fontSize: 14 }}>{j === 0 ? "라이브 — " : "다시보기 — "} {s.title} · 파트 {j + 1}</span>
                    <span style={{ fontSize: 12, color: "var(--rj-muted)", fontFamily: "var(--font-en)" }}>{j === 0 ? "LIVE" : "VOD"} · {28 + j * 4}m</span>
                    {(owned || (i === 0 && j === 0)) ? (
                      <button className="btn btn-sm btn-soft" onClick={onPlay}><Icon name="play" size={12} /> 재생</button>
                    ) : (
                      <Icon name="lock" size={14} className="" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// C. lessons=0 이고 syllabus=[] 인 레거시(showcase 전용 등) 강좌용 안전한 fallback
function CurriculumComingSoon() {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", border: "1px dashed var(--rj-line)", borderRadius: "var(--rj-r)", color: "var(--rj-muted)" }}>
      <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 20, color: "var(--rj-ink)" }}>커리큘럼 준비 중입니다.</div>
      <p style={{ marginTop: 10, fontSize: 14 }}>차시 구성이 등록되면 이곳에 표시됩니다.</p>
    </div>
  );
}

function Includes({ course }) {
  return (
    <div>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>What's Included</div>
          <h2 style={{ marginTop: 10 }}>이 강의에 포함된 것</h2>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 28 }}>
        {course.includes.map((it, i) => (
          <div key={i} className="card" style={{ padding: 22, display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--rj-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={16} />
            </span>
            <div style={{ fontSize: 15 }}>{it}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructorBlock({ ins, onMore }) {
  if (!ins) return null;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "start" }}>
        <span className="avatar avatar-xl" style={{ background: "var(--rj-ink)", color: "var(--rj-paper)" }}>{ins.initials}</span>
        <div>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Instructor · {ins.nameEn}</div>
          <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 36, margin: "10px 0", letterSpacing: "-0.025em" }}>{ins.name}</h2>
          <div className="tag" style={{ marginBottom: 16 }}>{ins.title}</div>
          <p style={{ maxWidth: 640, color: "var(--rj-ink)", lineHeight: 1.7 }}>{ins.bio}</p>
          <div style={{ display: "flex", gap: 40, marginTop: 24 }}>
            <div><div className="num-en" style={{ fontSize: 22, fontWeight: 600 }}>{ins.students.toLocaleString()}</div><div className="label-cap" style={{ color: "var(--rj-muted)" }}>Students</div></div>
            <div><div className="num-en" style={{ fontSize: 22, fontWeight: 600 }}>{ins.rating}</div><div className="label-cap" style={{ color: "var(--rj-muted)" }}>Rating</div></div>
            <div><div className="num-en" style={{ fontSize: 22, fontWeight: 600 }}>{ins.courses}</div><div className="label-cap" style={{ color: "var(--rj-muted)" }}>Courses</div></div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 24 }} onClick={onMore}>강사 페이지 보기 <Icon name="arrow" size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function ReviewsBlock({ reviews, rating, totalReviews }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 48, alignItems: "start" }}>
        <div style={{ padding: 24, border: "1px solid var(--rj-line)", borderRadius: "var(--rj-r)", textAlign: "center" }}>
          <div className="num-en" style={{ fontSize: 72, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1 }}>{rating}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 8, color: "var(--rj-ink)" }}>
            {[1,2,3,4,5].map((s) => <Icon key={s} name="star" size={16} />)}
          </div>
          <div style={{ fontSize: 13, color: "var(--rj-muted)", marginTop: 8 }}>{totalReviews.toLocaleString()}개의 후기</div>
        </div>
        <div style={{ display: "grid", gap: 20 }}>
          {reviews.length === 0 && [
            { id: "auto1", name: "최*예", grade: "고2", rating: 5, date: "2026.04.10", body: "매주가 닫히는 느낌. 라이브와 다시보기 사이클이 잘 짜여 있어요." },
            { id: "auto2", name: "윤*우", grade: "N수생", rating: 5, date: "2026.03.22", body: "강의실 안에서 질문이 바로 답으로 돌아옵니다. 답답함이 없어요." },
            { id: "auto3", name: "한*린", grade: "고3", rating: 4, date: "2026.03.05", body: "VOD 화질이 정말 좋아요. PIP로 같이 풀이 보면서 공부하기 좋습니다." },
          ].map(renderReview)}
          {reviews.map(renderReview)}
        </div>
      </div>
    </div>
  );
}
function renderReview(r) {
  return (
    <div key={r.id} className="card" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="avatar avatar-sm">{r.name.slice(0, 1)}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: "var(--rj-muted)" }}>{r.grade} · {r.date}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < r.rating ? "var(--rj-ink)" : "var(--rj-faint)" }}><Icon name="star" size={14} /></span>
          ))}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: "var(--rj-ink)", lineHeight: 1.65 }}>{r.body}</p>
    </div>
  );
}

function FAQBlock() {
  const faqs = [
    { q: "라이브 수업에 못 들어가면 어떻게 되나요?", a: "라이브가 종료된 후 5분 안에 1080p VOD로 변환되어 ‘다시보기’ 탭에 자동 업로드됩니다. 출석은 다시보기로도 인정됩니다." },
    { q: "라이브 강의실은 어떻게 입장하나요?", a: "리뉴젠 라이브 강의실은 사이트 안에서 바로 열립니다. 별도 앱 설치 없이 결제 후 발급되는 룸 코드로 입장하며, 화이트보드·실시간 채팅·질문권·소그룹 토론까지 한 화면에서 진행됩니다." },
    { q: "환불 정책이 어떻게 되나요?", a: "결제 후 7일 이내, 전체 강의 진도의 10% 미만 수강 시 100% 환불됩니다. 이후에는 잔여 회차 기준 일할 계산입니다." },
    { q: "여러 강의를 함께 신청할 수 있나요?", a: "네. 장바구니에 여러 강의를 담아 한 번에 결제할 수 있고, 2강의 이상 결제 시 5% 추가 할인됩니다." },
    { q: "모바일에서도 들을 수 있나요?", a: "네. iOS·Android 전용 앱에서 라이브와 다시보기 모두 지원합니다." },
  ];
  const [open, setOpen] = useStateC(0);
  return (
    <div style={{ borderTop: "1px solid var(--rj-line)" }}>
      {faqs.map((f, i) => (
        <div key={i} style={{ borderBottom: "1px solid var(--rj-faint)" }}>
          <button onClick={() => setOpen(open === i ? -1 : i)} style={{ width: "100%", textAlign: "left", padding: "22px 0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", background: "transparent" }}>
            <span style={{ fontFamily: "var(--font-kr-serif)", fontSize: 20, letterSpacing: "-0.025em" }}>{f.q}</span>
            <Icon name={open === i ? "minus" : "plus"} />
          </button>
          {open === i && <div style={{ paddingBottom: 22, color: "var(--rj-muted)", maxWidth: 720, fontSize: 15, lineHeight: 1.7 }}>{f.a}</div>}
        </div>
      ))}
    </div>
  );
}

function PreviewModal({ onClose, course }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div style={{ background: "#000", borderRadius: "var(--rj-r)", maxWidth: 960, width: "100%", aspectRatio: "16/9", position: "relative", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        <div className="dot-grid" style={{ position: "absolute", inset: 0, opacity: 0.2 }} />
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "pointer", border: "1px solid rgba(255,255,255,0.2)" }}>
          <Icon name="close" size={16} />
        </button>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", gap: 16 }}>
          <div className="eyebrow" style={{ color: "rgba(255,255,255,0.7)" }}>Preview · OT</div>
          <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 36, letterSpacing: "-0.025em" }}>{course.title}</div>
          <button className="btn btn-circle" style={{ width: 80, height: 80, background: "var(--rj-accent)", color: "var(--rj-ink)" }}><Icon name="play" size={32} /></button>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>3분 24초 미리보기</div>
        </div>
      </div>
    </div>
  );
}

window.CoursesPage = CoursesPage;
window.CourseDetailPage = CourseDetailPage;
