"use client";

export default function GlobalScrollArrows() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed bottom-6 right-5 z-[100] flex flex-col gap-2">
      <button
        type="button"
        aria-label="একদম উপরে যান"
        title="একদম উপরে যান"
        onClick={scrollToTop}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-2xl font-bold text-slate-700 shadow-lg transition hover:bg-slate-100"
      >
        ↑
      </button>

      <button
        type="button"
        aria-label="একদম নিচে যান"
        title="একদম নিচে যান"
        onClick={scrollToBottom}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-2xl font-bold text-slate-700 shadow-lg transition hover:bg-slate-100"
      >
        ↓
      </button>
    </div>
  );
}