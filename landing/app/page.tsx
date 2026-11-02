import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Calls, Compare, EarlyAccess, FAQ, Features, Hero, HowItWorks, OpenSource, Pricing, Updates } from "@/components/sections";
import { faqs } from "@/lib/content";
import { site } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: site.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: site.description,
      url: site.url,
    },
    {
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Calls />
        <HowItWorks />
        <Features />
        <Updates />
        <OpenSource />
        <Compare />
        <Pricing />
        <FAQ />
        <EarlyAccess />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </>
  );
}
