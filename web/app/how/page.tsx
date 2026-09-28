import { Row, Section, SectionHead } from "@/components/bits";
import { REPO_URL } from "@/lib/config";

export const metadata = { title: "How it works" };

const RULE: [string, string][] = [
  ["Conflicting evidence, or not enough to decide", "Undetermined"],
  ["Any requirement not satisfied", "Not established"],
  ["Any requirement not established either way", "Undetermined"],
  ["Every requirement satisfied", "Established"],
];

export default function How() {
  return (
    <Section className="flex flex-col gap-14">
      <div className="flex flex-col gap-3">
        <p className="t-label text-smoke">How it works</p>
        <h1 className="t-display max-w-[760px]">One question, asked of every claim</h1>
        <p className="t-body measure-wide text-graphite">
          Given an event type&apos;s written definition and criteria, and the evidence filed for one claim, does that
          evidence establish that the claimed event occurred as defined? Occurra answers only that. Whether anyone is
          paid follows in code from the answer.
        </p>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SectionHead title="Why validators, not an oracle" />
          <p className="t-small text-graphite">
            Occurra covers only events that must be read from evidence: water, fire or storm damage to a named property,
            a collision on a named vehicle, a consignment that arrived damaged or short, premises closed by damage.
            Whether a flood or a flight delay happened is published data an oracle can read, so those are not offered.
            Whether these photographs show this kitchen damaged by this leak needs judgment, and it is the kind that
            several independent readers can check.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <SectionHead title="What code does first" />
          <p className="t-small text-graphite">
            Everything countable is checked before any validator is asked: the bond, the filing window, the evidence the
            event type requires, the reserve that must cover the benefit. A claim that fails one is refused in words and
            nothing is spent on judgment.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionHead title="The rule that turns ratings into an outcome" />
        <p className="t-small measure-wide text-graphite">
          Each validator examines the photographs itself before it reads what anyone says about them, then rates every
          criterion and three checks the contract always asks: the right subject, a consistent cause, and documents that
          agree with the photographs. The contract applies this rule, in this order:
        </p>
        <div className="md:w-[640px]">
          {RULE.map(([when, then]) => <Row key={when} label={when}>{then}</Row>)}
        </div>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SectionHead title="Nobody grades their own evidence" />
          <ul className="t-small flex flex-col gap-3 text-graphite">
            <li>A rating stands only on a photograph the validators saw, or on the independent assessor&apos;s report. Paperwork alone can neither prove nor disprove an event.</li>
            <li>The sponsor files photographs only on its own appeal, and they can fail a requirement only beside a claimant&apos;s photograph or the assessor&apos;s observation.</li>
            <li>Where a claim has an accepted assessor, the claimant&apos;s photographs can satisfy a criterion only beside the assessor&apos;s observation.</li>
            <li>An established event must be every validator&apos;s own finding, and a failed requirement must be failed by every validator.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-4">
          <SectionHead title="Money, and every way out" />
          <ul className="t-small flex flex-col gap-3 text-graphite">
            <li>Established: the claimant is credited the benefit and the bond.</li>
            <li>Not established: the bond goes to the sponsor&apos;s reserve.</li>
            <li>Undetermined, or withdrawn before the evidence deadline: the bond comes back.</li>
            <li>Left to lapse: the bond goes to the reserve, since the benefit was held for the claimant all along.</li>
            <li>The party a determination went against may appeal once; both sides answer before it is judged again.</li>
            <li>Anyone can finalize once no appeal can be filed, and close a lapsed claim or an appeal left undecided for three days.</li>
            <li>Every amount waits in a ledger and leaves only in its owner&apos;s own withdrawal.</li>
          </ul>
        </div>
      </div>

      <p className="t-small text-graphite">
        The full specification is in the repository&apos;s{" "}
        <a href={`${REPO_URL}/blob/main/docs/design.md`} target="_blank" rel="noreferrer"
           className="underline decoration-fog underline-offset-4">design notes</a>, beside the contract it describes.
      </p>
    </Section>
  );
}
