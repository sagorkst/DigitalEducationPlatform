
const categories = [
  {
    number: "01",
    title: "একাডেমিক শিক্ষা",
    subtitle: "স্কুল, কলেজ ও বিশ্ববিদ্যালয়",
    icon: "🎓",
    color: "bg-blue-50 text-blue-700",
  },
  {
    number: "02",
    title: "চাকরি প্রস্তুতি",
    subtitle: "BCS, ব্যাংক ও সরকারি চাকরি",
    icon: "💼",
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    number: "03",
    title: "ভর্তি প্রস্তুতি",
    subtitle: "বিশ্ববিদ্যালয় ও অন্যান্য ভর্তি",
    icon: "📚",
    color: "bg-violet-50 text-violet-700",
  },
  {
    number: "04",
    title: "স্কিল ডেভেলপমেন্ট",
    subtitle: "দক্ষতা ও ক্যারিয়ার উন্নয়ন",
    icon: "🚀",
    color: "bg-orange-50 text-orange-700",
  },
];

const services = [
  { icon: "📝", title: "অনলাইন পরীক্ষা", desc: "নিজেকে যাচাই করুন মডেল টেস্টের মাধ্যমে", tag: "Practice" },
  { icon: "📖", title: "প্রশ্নব্যাংক", desc: "বিগত বছরের প্রশ্ন ও বিস্তারিত সমাধান", tag: "Question Bank" },
  { icon: "🎯", title: "অনলাইন কোর্স", desc: "দক্ষ প্রশিক্ষকদের কাছ থেকে শিখুন", tag: "Learning" },
  { icon: "📚", title: "ডিজিটাল লাইব্রেরি", desc: "বই, নোট ও প্রয়োজনীয় শিক্ষাসামগ্রী", tag: "Resources" },
];

const notices = [
  { type: "চাকরি", title: "সরকারি ও বেসরকারি চাকরির নতুন বিজ্ঞপ্তি", date: "সাম্প্রতিক আপডেট" },
  { type: "ভর্তি", title: "বিশ্ববিদ্যালয় ও শিক্ষাপ্রতিষ্ঠানের ভর্তি তথ্য", date: "ভর্তি সংক্রান্ত" },
  { type: "শিক্ষা", title: "শিক্ষা ও পরীক্ষার গুরুত্বপূর্ণ আপডেট", date: "শিক্ষা সংবাদ" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      {/* Top bar */}
      <div className="bg-slate-950 text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-2 text-xs sm:text-sm">
          <p>শিক্ষা, দক্ষতা ও ক্যারিয়ারের নির্ভরযোগ্য ঠিকানা</p>
          <p className="hidden sm:block">বাংলা | English</p>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <a href="#" className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white">
              শি
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-slate-900">শিক্ষাসেতু</div>
              <div className="text-[10px] font-medium tracking-widest text-slate-500">LEARN • GROW • SUCCEED</div>
            </div>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#" className="text-blue-700">হোম</a>
            <a href="#categories" className="transition hover:text-blue-700">শিক্ষা</a>
            <a href="#services" className="transition hover:text-blue-700">সেবাসমূহ</a>
            <a href="#notices" className="transition hover:text-blue-700">বিজ্ঞপ্তি</a>
            <a href="#about" className="transition hover:text-blue-700">আমাদের সম্পর্কে</a>
          </nav>

          <div className="flex items-center gap-3">
            <a href="#login" className="hidden rounded-lg px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:block">
              লগইন
            </a>
            <a href="#register" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800">
              শুরু করুন <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute -right-32 -top-40 h-[550px] w-[550px] rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 h-[450px] w-[450px] rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 md:grid-cols-2 md:py-28">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              আপনার ভবিষ্যৎ গড়ার ডিজিটাল প্ল্যাটফর্ম
            </div>

            <h1 className="max-w-2xl text-4xl font-extrabold leading-[1.35] text-white sm:text-5xl lg:text-6xl">
              শেখার নতুন পথ,
              <span className="block text-blue-400">সাফল্যের নতুন দিগন্ত</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              একাডেমিক শিক্ষা, চাকরি প্রস্তুতি, ভর্তি পরীক্ষা ও দক্ষতা উন্নয়ন—
              আপনার প্রয়োজনীয় সবকিছু এখন একই প্ল্যাটফর্মে।
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a href="#categories" className="rounded-xl bg-blue-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-1 hover:bg-blue-500">
                শেখা শুরু করুন <span aria-hidden="true">→</span>
              </a>
              <a href="#services" className="rounded-xl border border-slate-600 px-7 py-3.5 font-bold text-white transition hover:border-white hover:bg-white/10">
                সকল সেবা দেখুন
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-8 border-t border-white/10 pt-7">
              <div>
                <p className="text-2xl font-extrabold text-white">এক প্ল্যাটফর্ম</p>
                <p className="mt-1 text-sm text-slate-400">সব ধরনের প্রস্তুতি</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">২৪/৭</p>
                <p className="mt-1 text-sm text-slate-400">শেখার সুযোগ</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">সবার জন্য</p>
                <p className="mt-1 text-sm text-slate-400">সহজ শিক্ষার পরিবেশ</p>
              </div>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[2rem] bg-blue-500/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">আপনার শেখার ড্যাশবোর্ড</p>
                  <h3 className="mt-1 text-xl font-bold text-white">আজই শুরু করুন</h3>
                </div>
                <div className="rounded-xl bg-blue-500/20 p-3 text-2xl">🎓</div>
              </div>

              <div className="mt-7 rounded-2xl bg-white p-5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">আপনার প্রস্তুতি</span>
                  <span className="text-sm font-bold text-blue-700">চলমান</span>
                </div>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[70%] rounded-full bg-blue-600" />
                </div>
                <p className="mt-2 text-xs text-slate-500">নিয়মিত অনুশীলনে এগিয়ে যান</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <div className="text-2xl">📝</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">মডেল টেস্ট</p>
                    <p className="mt-1 text-xs text-slate-500">নিজেকে যাচাই করুন</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <div className="text-2xl">📚</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">স্টাডি নোট</p>
                    <p className="mt-1 text-xs text-slate-500">গুছিয়ে পড়াশোনা করুন</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl bg-blue-600/20 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-xl">✨</div>
                <div>
                  <p className="font-bold text-white">প্রতিদিন একটু একটু করে</p>
                  <p className="text-xs text-blue-200">আপনার লক্ষ্য অর্জনের পথে এগিয়ে যান</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Explore Learning</p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">আপনার শেখার ক্ষেত্র বেছে নিন</h2>
          <p className="mt-4 leading-7 text-slate-500">আপনার লক্ষ্য অনুযায়ী সঠিক বিভাগ নির্বাচন করে শুরু করুন প্রস্তুতি।</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((item) => (
            <a key={item.number} href="#services" className="group rounded-2xl border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${item.color}`}>
                {item.icon}
              </div>
              <p className="mt-6 text-xs font-bold tracking-widest text-slate-400">{item.number}</p>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{item.subtitle}</p>
              <div className="mt-6 font-bold text-blue-700 transition group-hover:translate-x-1">বিস্তারিত দেখুন →</div>
            </a>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Our Services</p>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">এক জায়গায় প্রয়োজনীয় সব সেবা</h2>
              <p className="mt-3 text-slate-500">পড়াশোনা ও ক্যারিয়ার উন্নয়নের জন্য প্রয়োজনীয় ডিজিটাল সুবিধা।</p>
            </div>
            <a href="#notices" className="font-bold text-blue-700 hover:text-blue-900">আরও জানুন →</a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service) => (
              <div key={service.title} className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{service.icon}</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{service.tag}</span>
                </div>
                <h3 className="mt-7 text-xl font-extrabold text-slate-900">{service.title}</h3>
                <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">{service.desc}</p>
                <a href="#register" className="mt-5 inline-block text-sm font-bold text-blue-700 hover:text-blue-900">শুরু করুন →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Notices */}
      <section id="notices" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mb-10 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-blue-700">Latest Updates</p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">সাম্প্রতিক বিজ্ঞপ্তি ও আপডেট</h2>
          <p className="mt-3 text-slate-500">গুরুত্বপূর্ণ তথ্য ও আপডেট এক জায়গায় দেখুন।</p>
        </div>

        <div className="mx-auto max-w-4xl divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-6">
          {notices.map((notice) => (
            <div key={notice.type} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xl">📢</div>
                <div>
                  <span className="text-xs font-bold text-blue-700">{notice.type}</span>
                  <h3 className="mt-1 font-bold text-slate-800">{notice.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{notice.date}</p>
                </div>
              </div>
              <a href="#register" className="shrink-0 text-sm font-bold text-blue-700 hover:text-blue-900">বিস্তারিত →</a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="px-5 pb-20">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-blue-700 px-7 py-14 text-center sm:px-12">
          <p className="text-sm font-bold tracking-widest text-blue-200">YOUR JOURNEY STARTS HERE</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-extrabold leading-snug text-white sm:text-4xl">
            আপনার লক্ষ্যকে বাস্তবে রূপ দিতে আজই শুরু করুন
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-blue-100">
            সঠিক পরিকল্পনা, নিয়মিত অনুশীলন এবং মানসম্মত শিক্ষাসামগ্রী নিয়ে এগিয়ে চলুন আপনার সাফল্যের পথে।
          </p>
          <a id="register" href="#categories" className="mt-8 inline-flex rounded-xl bg-white px-7 py-3.5 font-extrabold text-blue-700 transition hover:-translate-y-1 hover:bg-blue-50">
            যাত্রা শুরু করুন →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-2xl font-extrabold text-white">শিক্ষাসেতু</div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-slate-400">
              শিক্ষা, দক্ষতা ও ক্যারিয়ার উন্নয়নের জন্য একটি সমন্বিত ডিজিটাল প্ল্যাটফর্ম।
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">দ্রুত লিংক</h3>
            <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400">
              <a href="#categories" className="hover:text-white">শিক্ষার বিভাগ</a>
              <a href="#services" className="hover:text-white">আমাদের সেবাসমূহ</a>
              <a href="#notices" className="hover:text-white">সাম্প্রতিক বিজ্ঞপ্তি</a>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-white">শিক্ষা ও প্রস্তুতি</h3>
            <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400">
              <a href="#categories" className="hover:text-white">একাডেমিক শিক্ষা</a>
              <a href="#categories" className="hover:text-white">চাকরি প্রস্তুতি</a>
              <a href="#categories" className="hover:text-white">স্কিল ডেভেলপমেন্ট</a>
            </div>
          </div>
          <div id="login">
            <h3 className="font-bold text-white">যোগাযোগ</h3>
            <p className="mt-5 text-sm leading-7 text-slate-400">যোগাযোগের তথ্য ও সামাজিক যোগাযোগমাধ্যমের লিংক এখানে যুক্ত করা হবে।</p>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-slate-500">
          © 2026 শিক্ষাসেতু। সর্বস্বত্ব সংরক্ষিত।
        </div>
      </footer>
    </main>
  );
}
