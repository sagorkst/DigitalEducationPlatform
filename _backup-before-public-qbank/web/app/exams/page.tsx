import SectionPage from "../../components/section-page";

export default function Page() {
  return (
    <SectionPage
      title={"অনলাইন পরীক্ষা"}
      subtitle={"ONLINE EXAMINATION"}
      description={"নিজের প্রস্তুতি যাচাই করুন অনলাইন পরীক্ষা ও বিস্তারিত ফলাফল বিশ্লেষণের মাধ্যমে।"}
      icon={"📝"}
      features={["মডেল টেস্ট","বিষয়ভিত্তিক পরীক্ষা","সময় নির্ধারিত পরীক্ষা","তাৎক্ষণিক ফলাফল","ভুল উত্তরের বিশ্লেষণ","পরীক্ষার ইতিহাস"]}
    />
  );
}
