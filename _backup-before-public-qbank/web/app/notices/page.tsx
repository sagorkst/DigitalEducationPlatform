import SectionPage from "../../components/section-page";

export default function Page() {
  return (
    <SectionPage
      title={"নোটিশ ও আপডেট"}
      subtitle={"NOTICES \u0026 UPDATES"}
      description={"চাকরি, ভর্তি, শিক্ষা ও গুরুত্বপূর্ণ কার্যক্রমের বিজ্ঞপ্তি এক জায়গায় দেখুন।"}
      icon={"📢"}
      features={["চাকরির বিজ্ঞপ্তি","ভর্তি বিজ্ঞপ্তি","পরীক্ষার সময়সূচি","শিক্ষা সংক্রান্ত নোটিশ","গুরুত্বপূর্ণ ঘোষণা","সাম্প্রতিক আপডেট"]}
    />
  );
}
