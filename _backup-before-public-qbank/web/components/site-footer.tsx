const footerLinks = [
  { label: "একাডেমিক শিক্ষা", href: "/academic" },
  { label: "চাকরি প্রস্তুতি", href: "/career" },
  { label: "ভর্তি প্রস্তুতি", href: "/admission" },
  { label: "দক্ষতা উন্নয়ন", href: "/skills" },
  { label: "অনলাইন কোর্স", href: "/courses" },
  { label: "প্রশ্নব্যাংক", href: "/question-bank" },
  { label: "অনলাইন পরীক্ষা", href: "/exams" },
  { label: "ডিজিটাল লাইব্রেরি", href: "/library" },
];

export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#101d3a] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <a href="/" className="text-2xl font-black">🎓 শিক্ষাসেতু</a>
          <p className="mt-5 max-w-xs text-sm leading-7 text-slate-300">
            শিক্ষা, চাকরির প্রস্তুতি ও দক্ষতা উন্নয়নের জন্য একটি সমন্বিত ডিজিটাল প্ল্যাটফর্ম।
          </p>
        </div>

        <div>
          <h3 className="text-base font-extrabold">গুরুত্বপূর্ণ বিভাগ</h3>
          <div className="mt-5 grid gap-3">
            {footerLinks.slice(0, 4).map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-slate-300 transition hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-extrabold">শেখার সুবিধা</h3>
          <div className="mt-5 grid gap-3">
            {footerLinks.slice(4).map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-slate-300 transition hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-extrabold">অ্যাকাউন্ট</h3>
          <div className="mt-5 grid gap-3">
            <a href="/login" className="text-sm text-slate-300 transition hover:text-white">লগইন</a>
            <a href="/register" className="text-sm text-slate-300 transition hover:text-white">নতুন অ্যাকাউন্ট</a>
            <a href="/notices" className="text-sm text-slate-300 transition hover:text-white">নোটিশ</a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 শিক্ষাসেতু। সর্বস্বত্ব সংরক্ষিত।</p>
          <p>শিক্ষা হোক সবার জন্য, সম্ভাবনা হোক সীমাহীন।</p>
        </div>
      </div>
    </footer>
  );
}
