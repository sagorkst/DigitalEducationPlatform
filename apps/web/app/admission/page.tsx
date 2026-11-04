import SectionPage from "../../components/section-page";

export default function Page() {
  return (
    <SectionPage
      title={"ভর্তি প্রস্তুতি"}
      subtitle={"ADMISSION PREPARATION"}
      description={"বিশ্ববিদ্যালয় ও বিভিন্ন শিক্ষাপ্রতিষ্ঠানের ভর্তি পরীক্ষার প্রস্তুতি।"}
      icon={"📚"}
      features={["বিশ্ববিদ্যালয় ভর্তি","মেডিকেল ভর্তি","ইঞ্জিনিয়ারিং ভর্তি","বিষয়ভিত্তিক প্রশ্ন","ভর্তি পরীক্ষার মডেল টেস্ট","ভর্তি নির্দেশিকা"]}
    />
  );
}
