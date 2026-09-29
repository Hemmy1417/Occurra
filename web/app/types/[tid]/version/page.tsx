"use client";

import { useParams } from "next/navigation";

import { Empty, Loading, ReadFailure, Section } from "@/components/bits";
import { TypeForm } from "@/components/TypeForm";
import { prose } from "@/lib/present";
import { getEventType, getTypeVersion } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function NewVersion() {
  const { tid } = useParams<{ tid: string }>();
  const type = useChain(`type.${tid}`, (f) => getEventType(tid, f));
  const t = type.data;
  const version = useChain(t ? `version.${tid}.${t.version}` : null, () => getTypeVersion(tid, t!.version));
  if (type.error) return <Section><ReadFailure what="this event type" retrying={type.retrying} /></Section>;
  if (type.data === null) return <Section><Empty>There is no event type with this number.</Empty></Section>;
  if (!t || !version.data) return <Section><Loading what="the event type" /></Section>;
  return (
    <Section>
      <div className="flex flex-col gap-3 pb-10">
        <p className="t-label text-smoke">{prose(t.title)}</p>
        <h1 className="t-display">Publish version {t.version + 1}</h1>
        <p className="t-body measure-wide text-graphite">
          Every version is kept. The category and event kind stay as they are; write a new event type for another.
        </p>
      </div>
      <TypeForm base={version.data} tid={tid} />
    </Section>
  );
}
