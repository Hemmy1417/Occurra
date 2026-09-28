import { ButtonLink, Section } from "@/components/bits";

export default function NotFound() {
  return (
    <Section>
      <h1 className="t-display">Nothing is recorded here</h1>
      <p className="t-body measure mt-4 text-graphite">This page does not exist. The record itself is one click away.</p>
      <div className="mt-6"><ButtonLink href="/">Back to Occurra</ButtonLink></div>
    </Section>
  );
}
