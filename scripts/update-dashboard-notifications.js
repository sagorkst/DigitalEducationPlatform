const fs = require("fs");
const file = "apps/web/app/dashboard/page.tsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes('const [profileOpen, setProfileOpen] = useState(false);')) {
  throw new Error("Profile state not found. File unchanged.");
}

s = s.replace(
  'const [profileOpen, setProfileOpen] = useState(false);',
  'const [profileOpen, setProfileOpen] = useState(false);\n  const [notificationOpen, setNotificationOpen] = useState(false);'
);

const oldBell = `              <button type="button" className="relative rounded-xl border border-slate-200 bg-white p-3">
                🔔
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>`;

const newBell = `              <div className="relative">
                <button type="button"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  aria-label="নোটিফিকেশন"
                  aria-expanded={notificationOpen}
                  className="relative rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50">
                  🔔
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
                </button>
                {notificationOpen && (
                  <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-black text-slate-900">নোটিফিকেশন</h3>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">৩টি নতুন</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50">📝</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">নতুন মডেল টেস্ট উপলভ্য</p>
                          <p className="mt-1 text-xs text-slate-500">বাংলা মডেল টেস্ট - ০২ এখন অনুশীলন করতে পারবেন।</p>
                          <p className="mt-1 text-xs text-slate-400">১০ মিনিট আগে</p>
                        </div>
                      </div>
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50">📚</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">কোর্সের নতুন পাঠ যোগ হয়েছে</p>
                          <p className="mt-1 text-xs text-slate-500">English Grammar কোর্সে নতুন পাঠ যুক্ত হয়েছে।</p>
                          <p className="mt-1 text-xs text-slate-400">গতকাল</p>
                        </div>
                      </div>
                      <div className="flex gap-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50">📢</span>
                        <div>
                          <p className="text-sm font-bold text-slate-800">নতুন নোটিশ প্রকাশিত</p>
                          <p className="mt-1 text-xs text-slate-500">শিক্ষাসেতুর সর্বশেষ নোটিশ দেখে নিন।</p>
                          <p className="mt-1 text-xs text-slate-400">২ দিন আগে</p>
                        </div>
                      </div>
                    </div>
                    <a href="/notices" className="mt-2 block rounded-lg bg-blue-50 px-3 py-2 text-center text-sm font-bold text-blue-700 hover:bg-blue-100">
                      সব নোটিশ দেখুন →
                    </a>
                  </div>
                )}
              </div>`;

if (!s.includes(oldBell)) {
  throw new Error("Notification button not found. File unchanged.");
}

s = s.replace(oldBell, newBell);
fs.writeFileSync(file, s, "utf8");
console.log("Notification dropdown added successfully.");
