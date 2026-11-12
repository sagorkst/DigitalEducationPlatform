type SectionPageProps = {
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  features: string[];
};

export default function SectionPage({
  title,
  subtitle,
  description,
  icon,
  features,
}: SectionPageProps) {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-800">
      <section className="bg-[#101d3a] px-5 py-20 text-white sm:py-28">
        <div className="mx-auto max-w-7xl">
          <a href="/" className="text-sm font-semibold text-blue-300 hover:text-white">
            ← হোম পেজে ফিরে যান
          </a>

          <div className="mt-12 max-w-3xl">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-4xl">
              {icon}
            </div>

            <p className="text-sm font-bold tracking-widest text-blue-300">
              {subtitle}
            </p>

            <h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
              {title}
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              {description}
            </p>

            <a
              href="/register"
              className="mt-9 inline-flex rounded-xl bg-blue-600 px-7 py-3.5 font-bold text-white transition hover:bg-blue-500"
            >
              শুরু করুন →
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="mb-10">
          <p className="text-sm font-bold tracking-widest text-blue-700">
            EXPLORE FEATURES
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-900">
            এই বিভাগের সুবিধাসমূহ
          </h2>
          <p className="mt-3 text-slate-500">
            আপনার প্রয়োজনীয় সুবিধাগুলো পর্যায়ক্রমে এখানে যুক্ত করা হবে।
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={feature}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-lg font-black text-blue-700">
                {String(index + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-slate-900">
                {feature}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                প্রয়োজনীয় তথ্য ও কার্যক্রম এখানে পাওয়া যাবে।
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="rounded-2xl bg-blue-50 p-8 sm:p-10">
          <h2 className="text-2xl font-black text-slate-900">
            আপনার শেখার যাত্রা শুরু করুন
          </h2>
          <p className="mt-3 text-slate-600">
            শিক্ষাসেতুর সঙ্গে আপনার লক্ষ্য অর্জনের পথে এগিয়ে চলুন।
          </p>
          <a
            href="/"
            className="mt-6 inline-flex font-bold text-blue-700 hover:text-blue-900"
          >
            হোম পেজে ফিরে যান →
          </a>
        </div>
      </section>
    </main>
  );
}
