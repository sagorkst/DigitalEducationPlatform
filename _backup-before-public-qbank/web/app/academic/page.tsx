import SectionPage from "../../components/section-page";

export default function Page() {
  return (
    <SectionPage
      title={"একাডেমিক শিক্ষা"}
      subtitle={"ACADEMIC LEARNING"}
      description={"স্কুল, কলেজ ও বিশ্ববিদ্যালয়ের শিক্ষার্থীদের জন্য পড়াশোনা, অনুশীলন ও শিক্ষাসামগ্রী।"}
      icon={"🎓"}
      features={["স্কুল পর্যায়ের শিক্ষা","কলেজ পর্যায়ের শিক্ষা","বিশ্ববিদ্যালয় শিক্ষা","বিষয়ভিত্তিক নোট","অনুশীলন ও মূল্যায়ন","শিক্ষা সহায়িকা"]}
    />
  );
}
