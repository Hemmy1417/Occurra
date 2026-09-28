"use client";

import { Section } from "@/components/bits";
import { TypeForm } from "@/components/TypeForm";

export default function NewType() {
  return (
    <Section>
      <div className="flex flex-col gap-3 pb-10">
        <p className="t-label text-smoke">For sponsors</p>
        <h1 className="t-display">Write an event type</h1>
        <p className="t-body measure-wide text-graphite">
          Define one kind of event that must be read from evidence: damage to a property, a vehicle or a consignment, or
          premises closed by damage or an obstruction. Hazards, flight status and weather indices are published data an
          oracle reads, so they are not offered here.
        </p>
      </div>
      <TypeForm />
    </Section>
  );
}
