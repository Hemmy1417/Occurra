"use client";

import Link from "next/link";

import { ButtonLink, Empty, Loading, ReadFailure, Section, SectionHead } from "@/components/bits";
import { category, eventKind, gen, plural, prose, typeState } from "@/lib/present";
import { listEventTypes } from "@/lib/read";
import { useChain } from "@/lib/useChain";

export default function Types() {
  const types = useChain("types.all", (f) => listEventTypes(0, 50, f));
  return (
    <Section>
      <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="flex flex-col gap-3">
          <p className="t-label text-smoke">Event types</p>
          <h1 className="t-display">What can be claimed</h1>
          <p className="t-body measure text-graphite">
            Each event type is a sponsor&apos;s written definition of one kind of event, with the criteria and evidence a
            claim must meet and the reserve that pays for it.
          </p>
        </div>
        <ButtonLink href="/types/new">Write an event type</ButtonLink>
      </div>
      <SectionHead title="Every event type" aside={types.data ? plural(types.data.total, "type") : undefined} />
      {types.data ? (
        types.data.event_types.length ? (
          <ul>
            {types.data.event_types.map((t) => (
              <li key={t.type_id}>
                <Link href={`/types/${t.type_id}`}
                      className="grid gap-2 border-b border-[#d9d9d9] py-5 hover:bg-haze md:grid-cols-[1fr_200px_160px_140px] md:items-baseline md:gap-6 md:px-2">
                  <span className="flex flex-col gap-1">
                    <span className="t-sub text-obsidian">{prose(t.title)}</span>
                    <span className="t-label text-smoke">{category(t.category)} · {eventKind(t.event_kind)}</span>
                  </span>
                  <span className="t-small">Pays {gen(t.benefit_wei)}</span>
                  <span className="t-small text-graphite">{plural(t.open_claims, "open claim")}</span>
                  <span className="t-label text-graphite">{typeState(t.state)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className="py-6"><Empty>No event type has been written yet.</Empty></div>
      ) : types.error ? <ReadFailure what="the event types" retrying={types.retrying} /> : <div className="py-6"><Loading what="the event types" /></div>}
    </Section>
  );
}
