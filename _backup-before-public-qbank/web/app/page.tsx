import { Button, Card, Input, Badge } from "@shikhasetu/ui";

const categories = [
  {
    icon: "🎓",
    title: "একাডেমিক শিক্ষা", href: "/academic",
    description: "স্কুল, কলেজ ও বিশ্ববিদ্যালয়ের পড়াশোনা",
    color: "bg-blue-50 text-blue-700",
    count: "Academic Learning",
  },
  {
    icon: "💼",
    title: "চাকরি প্রস্তুতি", href: "/career",
    description: "BCS, ব্যাংক ও সরকারি-বেসরকারি চাকরি",
    color: "bg-emerald-50 text-emerald-700",
    count: "Career Preparation",
  },
  {
    icon: "📚",
    title: "ভর্তি প্রস্তুতি", href: "/admission",
    description: "বিশ্ববিদ্যালয় ও বিভিন্ন ভর্তি পরীক্ষা",
    color: "bg-violet-50 text-violet-700",
    count: "Admission",
  },
  {
    icon: "🚀",
    title: "দক্ষতা উন্নয়ন", href: "/skills",
    description: "প্রযুক্তি, ফ্রিল্যান্সিং ও পেশাগত দক্ষতা",
    color: "bg-orange-50 text-orange-700",
    count: "Skill Development",
  },
];

const services = [
  {
    icon: "📝",
    title: "অনলাইন পরীক্ষা", href: "/exams",
    description: "মডেল টেস্ট, টাইমড পরীক্ষা ও বিস্তারিত ফলাফল বিশ্লেষণ।",
    color: "bg-blue-50",
  },
  {
    icon: "📖",
    title: "প্রশ্নব্যাংক", href: "/question-bank",
    description: "বিগত বছরের প্রশ্ন, বিষয়ভিত্তিক প্রশ্ন ও সমাধান।",
    color: "bg-emerald-50",
  },
  {
    icon: "🎯",
    title: "অনলাইন কোর্স", href: "/courses",
    description: "দক্ষ প্রশিক্ষকের মাধ্যমে পরিকল্পিতভাবে শেখার সুযোগ।",
    color: "bg-violet-50",
  },
  {
    icon: "📚",
    title: "ডিজিটাল লাইব্রেরি", href: "/library",
    description: "বই, নোট, গাইডলাইন ও প্রয়োজনীয় শিক্ষাসামগ্রী।",
    color: "bg-orange-50",
  },
  {
    icon: "📊",
    title: "পারফরম্যান্স বিশ্লেষণ", href: "/exams",
    description: "নিজের অগ্রগতি, দুর্বলতা ও প্রস্তুতির মান যাচাই।",
    color: "bg-pink-50",
  },
  {
    icon: "🏫",
    title: "প্রতিষ্ঠান ব্যবস্থাপনা", href: "/academic",
    description: "শিক্ষক, শিক্ষার্থী, ক্লাস ও পরীক্ষা পরিচালনা।",
    color: "bg-cyan-50",
  },
];

const notices = [
  {
    category: "চাকরি",
    title: "সরকারি ও বেসরকারি চাকরির বিজ্ঞপ্তি",
    date: "চাকরির আপডেট",
    color: "bg-blue-50 text-blue-700",
  },
  {
    category: "ভর্তি",
    title: "বিশ্ববিদ্যালয় ও শিক্ষাপ্রতিষ্ঠানের ভর্তি তথ্য",
    date: "ভর্তি সংক্রান্ত",
    color: "bg-violet-50 text-violet-700",
  },
  {
    category: "শিক্ষা",
    title: "শিক্ষা ও পরীক্ষার গুরুত্বপূর্ণ ঘোষণা",
    date: "শিক্ষা সংবাদ",
    color: "bg-emerald-50 text-emerald-700",
  },
];

const learningFeatures = [
  "নিজের লক্ষ্য অনুযায়ী প্রস্তুতির পরিকল্পনা",
  "বিষয়ভিত্তিক প্রশ্ন অনুশীলন",
  "নিয়মিত মডেল টেস্ট ও পরীক্ষা",
  "ফলাফল ও অগ্রগতি বিশ্লেষণ",
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-800">

      {/* Top information bar */}
      <div className="bg-[#101d3a] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-2 text-xs sm:text-sm">
          <p className="text-blue-100">
            শিক্ষা, দক্ষতা ও ক্যারিয়ার উন্নয়নের সমন্বিত প্ল্যাটফর্ম
          </p>
          <p className="text-blue-200">বাংলা | English</p>
        </div>
      </div>

      {/* Main header */}


      {/* Hero section */}
      <section className="relative overflow-hidden bg-[#101d3a]">
        <div className="absolute -right-40 -top-40 h-[550px] w-[550px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute -bottom-40 -left-32 h-[450px] w-[450px] rounded-full bg-indigo-500/20 blur-[100px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 md:grid-cols-2 md:py-28">

          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-xs font-bold text-blue-200 sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              আপনার ভবিষ্যৎ গড়ার ডিজিটাল ঠিকানা
            </div>

            <h1 className="max-w-2xl text-4xl font-black leading-[1.4] tracking-tight text-white sm:text-5xl lg:text-6xl">
              শেখার নতুন পথ,
              <span className="block text-blue-400">
                সফলতার নতুন দিগন্ত
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              একাডেমিক শিক্ষা, চাকরির প্রস্তুতি, ভর্তি পরীক্ষা ও দক্ষতা উন্নয়ন—
              আপনার প্রয়োজনীয় সবকিছু এখন একটি সমন্বিত প্ল্যাটফর্মে।
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="#categories"
                className="rounded-xl bg-blue-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-1 hover:bg-blue-500"
              >
                শেখা শুরু করুন →
              </a>
              <a
                href="#services"
                className="rounded-xl border border-slate-500 px-7 py-3.5 font-bold text-white transition hover:border-white hover:bg-white/10"
              >
                সকল সুবিধা দেখুন
              </a>
            </div>

            <div className="mt-12 flex flex-wrap gap-8 border-t border-white/10 pt-7">
              <div>
                <p className="text-2xl font-black text-white">এক প্ল্যাটফর্ম</p>
                <p className="mt-1 text-xs text-slate-400">বহুমুখী শিক্ষার সুযোগ</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">২৪/৭</p>
                <p className="mt-1 text-xs text-slate-400">শেখার সুযোগ</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">সবার জন্য</p>
                <p className="mt-1 text-xs text-slate-400">সহজ ডিজিটাল শিক্ষা</p>
              </div>
            </div>
          </div>

          {/* Hero dashboard illustration */}
          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-5 rounded-[35px] bg-blue-500/20 blur-3xl" />

            <div className="relative rounded-[28px] border border-white/10 bg-white/[0.08] p-5 shadow-2xl backdrop-blur-xl sm:p-7">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">আপনার শেখার জগৎ</p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    আজই শুরু করুন
                  </h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-2xl">
                  🎓
                </div>
              </div>

              <div className="mt-7 rounded-2xl bg-white p-5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">আপনার প্রস্তুতি</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    শেখার যাত্রা
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-blue-50 p-4">
                    <div className="text-2xl">📝</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">অনলাইন পরীক্ষা</p>
                    <p className="mt-1 text-xs text-slate-500">নিজেকে যাচাই করুন</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <div className="text-2xl">📖</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">প্রশ্নব্যাংক</p>
                    <p className="mt-1 text-xs text-slate-500">অনুশীলন করুন</p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-4">
                    <div className="text-2xl">🎯</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">অনলাইন কোর্স</p>
                    <p className="mt-1 text-xs text-slate-500">দক্ষতা বাড়ান</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-4">
                    <div className="text-2xl">📚</div>
                    <p className="mt-2 text-sm font-bold text-slate-800">ডিজিটাল লাইব্রেরি</p>
                    <p className="mt-1 text-xs text-slate-500">জ্ঞান অর্জন করুন</p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">নিয়মিত শেখার অভ্যাস</span>
                    <span className="text-blue-700">প্রতিদিন</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    প্রতিদিন একটু একটু করে এগিয়ে যান।
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-blue-500/15 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/30 text-xl">
                  ✨
                </div>
                <div>
                  <p className="font-bold text-white">আপনার লক্ষ্য, আপনার যাত্রা</p>
                  <p className="text-xs text-blue-200">
                    শেখার প্রতিটি ধাপে শিক্ষাসেতু
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search section */}
      <section className="relative z-10 mx-auto -mt-1 max-w-5xl px-5 pt-8">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-xl shadow-slate-900/5 sm:p-6">
          <div className="mb-3">
            <h2 className="font-extrabold text-slate-900">আপনি কী শিখতে চান?</h2>
            <p className="text-sm text-slate-500">
              আপনার প্রয়োজনীয় শিক্ষা, কোর্স বা প্রস্তুতি খুঁজে নিন।
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <Input
                type="search"
                placeholder="কোর্স, বিষয়, পরীক্ষা বা প্রশ্ন খুঁজুন..."
                aria-label="শিক্ষাসামগ্রী খুঁজুন"
                className="bg-slate-50 px-5 py-3.5 focus:bg-white"
              />
            </div>
            <Button size="lg" className="px-8">
              🔍 খুঁজুন
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="mx-auto max-w-7xl px-5 py-20">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-[3px] text-blue-700">
            EXPLORE YOUR FUTURE
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">
            আপনার শেখার ক্ষেত্র বেছে নিন
          </h2>
          <p className="mt-4 leading-7 text-slate-500">
            আপনার লক্ষ্য অনুযায়ী সঠিক বিভাগ নির্বাচন করে শেখার যাত্রা শুরু করুন।
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((item, index) => (
            <Card
              key={item.title}
              className="group p-6 transition duration-300 hover:-translate-y-2 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
            >
              <a href={item.href} className="block">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${item.color}`}>
                {item.icon}
              </div>
              <p className="mt-6 text-xs font-bold tracking-widest text-slate-400">
                0{index + 1} / {item.count}
              </p>
              <h3 className="mt-2 text-xl font-extrabold text-slate-900">
                {item.title}
              </h3>
              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
              <div className="mt-6 font-bold text-blue-700 transition group-hover:translate-x-1">
                বিস্তারিত দেখুন →
              </div>
              </a>
            </Card>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="bg-[#f5f7fc] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold tracking-[3px] text-blue-700">
                OUR PLATFORM
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">
                এক জায়গায় প্রয়োজনীয় সব সেবা
              </h2>
              <p className="mt-3 max-w-2xl text-slate-500">
                পড়াশোনা, পরীক্ষা, ক্যারিয়ার ও প্রতিষ্ঠান পরিচালনার জন্য
                প্রয়োজনীয় ডিজিটাল সুবিধা।
              </p>
            </div>
            <a href="#learning" className="shrink-0 font-bold text-blue-700 hover:text-blue-900">
              আরও জানুন →
            </a>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <Card
                key={service.title}
                className="group p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${service.color}`}>
                  {service.icon}
                </div>
                <h3 className="mt-6 text-xl font-extrabold text-slate-900">
                  {service.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {service.description}
                </p>
                <a
                  href={service.href}
                  className="mt-6 inline-block text-sm font-bold text-blue-700 transition group-hover:translate-x-1"
                >
                  শুরু করুন →
                </a>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Learning feature */}
      <section id="learning" className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold tracking-[3px] text-blue-700">
            SMART LEARNING EXPERIENCE
          </p>
          <h2 className="mt-4 text-3xl font-black leading-snug text-slate-900 sm:text-4xl">
            শুধু শেখা নয়,
            <span className="block text-blue-700">নিজের অগ্রগতিও দেখুন</span>
          </h2>
          <p className="mt-5 leading-8 text-slate-500">
            পরিকল্পিত পড়াশোনা, নিয়মিত অনুশীলন ও ফলাফল বিশ্লেষণের মাধ্যমে
            নিজের প্রস্তুতিকে আরও কার্যকর করে তুলুন।
          </p>

          <div className="mt-8 space-y-4">
            {learningFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                  ✓
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {feature}
                </span>
              </div>
            ))}
          </div>

          <a
            href="/register"
            className="mt-9 inline-flex rounded-xl bg-blue-700 px-7 py-3.5 font-bold text-white shadow-lg shadow-blue-700/20 transition hover:-translate-y-1 hover:bg-blue-800"
          >
            শেখার যাত্রা শুরু করুন →
          </a>
        </div>

        <div className="relative">
          <div className="absolute -inset-5 rounded-[35px] bg-blue-100 blur-3xl" />
          <div className="relative rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl sm:p-9">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Learning Dashboard</p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">
                  শেখার অগ্রগতি
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                📊
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-blue-50 p-5">
              <p className="text-sm font-bold text-slate-700">আপনার শেখার পরিকল্পনা</p>
              <div className="mt-4 flex items-end justify-between">
                <span className="text-3xl font-black text-blue-700">নিয়মিত</span>
                <span className="text-xs font-semibold text-blue-600">প্রতিদিন অগ্রগতি</span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
                <div className="h-full w-3/4 rounded-full bg-blue-600" />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-100 p-5">
                <div className="text-2xl">📝</div>
                <p className="mt-3 font-bold text-slate-800">অনুশীলন</p>
                <p className="mt-1 text-xs text-slate-500">প্রশ্ন সমাধান</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-5">
                <div className="text-2xl">🏆</div>
                <p className="mt-3 font-bold text-slate-800">অর্জন</p>
                <p className="mt-1 text-xs text-slate-500">লক্ষ্যের পথে এগিয়ে যান</p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
              <span className="text-2xl">✨</span>
              <p className="text-sm font-semibold text-emerald-800">
                প্রতিদিনের ছোট অগ্রগতিই বড় সাফল্য তৈরি করে।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Notices */}
      <section id="notices" className="bg-[#f5f7fc] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <div className="mb-10 text-center">
            <p className="text-sm font-bold tracking-[3px] text-blue-700">
              LATEST UPDATES
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-900 sm:text-4xl">
              নোটিশ ও গুরুত্বপূর্ণ আপডেট
            </h2>
            <p className="mt-3 text-slate-500">
              প্রয়োজনীয় ঘোষণা ও তথ্য এক জায়গায় দেখুন।
            </p>
          </div>

          <div className="mx-auto max-w-4xl divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
            {notices.map((notice) => (
              <div
                key={notice.category}
                className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-xl">
                    📢
                  </div>
                  <div>
                    <Badge className={notice.color}>
                      {notice.category}
                    </Badge>
                    <h3 className="mt-2 font-bold text-slate-800">
                      {notice.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">{notice.date}</p>
                  </div>
                </div>
                <a href="/register" className="shrink-0 text-sm font-bold text-blue-700 hover:text-blue-900">
                  বিস্তারিত →
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section id="about" className="px-5 py-20">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 px-7 py-16 text-center shadow-2xl shadow-blue-900/15 sm:px-14">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[40px] border-white/5" />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[40px] border-white/5" />

          <div className="relative">
            <p className="text-sm font-bold tracking-[3px] text-blue-200">
              YOUR JOURNEY STARTS HERE
            </p>
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-black leading-snug text-white sm:text-4xl">
              আপনার লক্ষ্যকে বাস্তবে রূপ দিতে আজই শুরু করুন
            </h2>
            <p className="mx-auto mt-5 max-w-2xl leading-8 text-blue-100">
              সঠিক পরিকল্পনা, নিয়মিত অনুশীলন ও মানসম্মত শিক্ষাসামগ্রী নিয়ে
              এগিয়ে চলুন আপনার সাফল্যের পথে।
            </p>
            <a
              id="register"
              href="#categories"
              className="mt-9 inline-flex rounded-xl bg-white px-8 py-4 font-extrabold text-blue-700 shadow-lg transition hover:-translate-y-1 hover:bg-blue-50"
            >
              যাত্রা শুরু করুন →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}

    </main>
  );
}








