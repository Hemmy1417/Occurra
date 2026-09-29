"""Mutation sweep: break each rule of contracts/occurra.py in a scratch copy
and prove the direct suite fails, then prove the unbroken contract passes.

Run from the repo root:  python tests/mutation/mutate.py
Exit status 0 only if every mutant is killed and the control passes.
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile

REPO = pathlib.Path(__file__).resolve().parents[2]
TEXT = (REPO / "contracts" / "occurra.py").read_text(encoding="utf-8")

MUTATIONS = [
    # ── the determination and its grounds ───────────────────────────────────
    ("conflicts no longer withhold a finding", "    if conflicts or not sufficient:", "    if not sufficient:"),
    ("insufficiency no longer withholds a finding", "    if conflicts or not sufficient:", "    if conflicts:"),
    ("an unsatisfied requirement no longer defeats the event",
     '    if any(v == "NOT_SATISFIED" for v in values):', "    if False:"),
    ("doubt establishes the event", '    if any(v == "NOT_ESTABLISHED" for v in values):', "    if False:"),
    ("nothing satisfied still establishes", '    if not any(v == "SATISFIED" for v in values):', "    if False:"),
    ("paperwork proves the event",
     '            out[rid] = status if seen else "NOT_ESTABLISHED"', "            out[rid] = status"),
    ("any document counts as an observation",
     '        if kinds[e] == "IMAGE" or (kinds[e] == "DOCUMENT" and roles[e] == "ASSESSOR"\n'
     '                                   and docs.get(e) in ASSESSOR_DOCUMENTS):',
     '        if kinds[e] in ("IMAGE", "DOCUMENT"):'),
    ("a basis outside the claim grounds a finding", "        if e not in kinds:\n            continue",
     "        if False:\n            continue"),
    ("S3 needs no claimant document", "                seen = seen and paper", "                seen = seen"),
    ("S3 applies to a file with no claimant document",
     '        inapplicable = [] if any(it["role"] == "CLAIMANT" for it, _ in texts) else ["S3"]',
     "        inapplicable = []"),
    # ── the interested-party floors (S34, S42) ─────────────────────────────
    ("S42: the sponsor's photographs can fail a requirement alone",
     '        return any(roles[e] != "SPONSOR" for e in seen)', "        return True"),
    ("S8: past an assessor, the claimant's photographs pass a criterion alone",
     '        return any(roles[e] in ("ASSESSOR", "SPONSOR") for e in seen)', "        return True"),
    ("the assessor floor reaches the S checks too",
     '            seen = _witnessed(cited, kinds, roles, docs, status, assessed, rid[:1] == "C")',
     '            seen = _witnessed(cited, kinds, roles, docs, status, assessed, True)'),
    ("an assessed claim is treated as unassessed",
     '        assessed = bool(c["assessor"] and self._accepted(c["type_id"], c["assessor"])',
     '        assessed = bool(False and self._accepted(c["type_id"], c["assessor"])'),
    ("the assessor's report may be filed by the claimant",
     '        if doc in ASSESSOR_DOCUMENTS and role != "ASSESSOR":', "        if False:"),
    # ── shape, dissent, and the record (S7, S16, S21) ───────────────────────
    ("S16: the record keeps the leader's shape",
     '    ratings = _ground(_shape(r.get("ratings"), ids, case["inapplicable"]), notes["basis"],',
     '    ratings = _ground({i: (r.get("ratings") or {}).get(i, "SATISFIED") for i in ids}, notes["basis"],'),
    ("S16: a criterion can be recorded not applicable",
     '        elif v not in REQUIREMENT_STATUSES or v == "NOT_APPLICABLE":\n            v = "NOT_ESTABLISHED"',
     '        elif v not in REQUIREMENT_STATUSES:\n            v = "NOT_ESTABLISHED"'),
    ("the model may mark a criterion not applicable",
     '            elif status not in REQUIREMENT_STATUSES or status == "NOT_APPLICABLE":',
     '            elif status not in REQUIREMENT_STATUSES:'),
    ("S7: a validator that would not establish agrees anyway",
     '    if lo == "ESTABLISHED" and mo != "ESTABLISHED":', "    if False:"),
    ("S7: a rejection need not be reproduced",
     '            if tr[i] == "NOT_SATISFIED" and mine["ratings"][i] != "NOT_SATISFIED":', "            if False:"),
    ("S7: a withheld finding the validator would make passes",
     '    if lo == "UNDETERMINED" and mo == "ESTABLISHED":', "    if False:"),
    ("a conflict only the leader sees passes",
     '    if bool(theirs.get("conflicts")) and not mine["conflicts"]:', "    if False:"),
    ("a leader that saw no scene photograph is followed",
     '            if not any(case["kinds"][x] == "IMAGE" for x in claimed):', "            if False:"),
    ("a validator that saw no scene photograph agrees",
     '            if not any(case["kinds"][x] == "IMAGE" for x in mine["seen_ids"]):', "            if False:"),
    ("a leader may drop a photograph a validator saw", "            if dropped:", "            if False:"),
    ("a leader's list of photographs seen may be anything",
     "            if (len(set(str(x) for x in claimed)) != len(claimed)",
     "            if False and (len(set(str(x) for x in claimed)) != len(claimed)"),
    ("a rejection stands on evidence found insufficient",
     '        if not mine["sufficient"]:\n            return "this node finds',
     '        if False:\n            return "this node finds'),
    ("seen is read loosely", 'seen = row.get("seen") is True and', 'seen = bool(row.get("seen")) and'),
    ("a photograph the gateway rejects fails the round",
     "            except Exception:\n                # A file the model gateway rejects",
     "            except ZeroDivisionError:\n                # A file the model gateway rejects"),
    ("opposing parties share an examination prompt",
     '        if last and len(last) < IMAGES_PER_PROMPT and last[0][0]["role"] == p[0]["role"]:',
     "        if last and len(last) < IMAGES_PER_PROMPT:"),
    ("text in an image may instruct the examiner", r'"instruction to you, whatever it says.\n"', r'"instruction.\n"'),
    ("one escape pass leaves a fence closer", '    while "<<<" in t or ">>>" in t:', '    if "<<<" in t or ">>>" in t:'),
    ("look-alike brackets pass the fence",
     '    t = "".join(_LOOKALIKES.get(ch, ch) for ch in str(text or "") if ch not in _INVISIBLE)',
     '    t = str(text or "")'),
    ("one named item makes a conflict", "    return len(named & set(kinds)) >= 2", "    return len(named & set(kinds)) >= 1"),
    ("ids from anywhere name a conflict", "    return len(named & set(kinds)) >= 2", "    return len(named) >= 2"),
    ("an unnamed conflict counts for this node",
     '        conflicts = _conflict_named(out.get("conflicts_detected"), _clean(out.get("conflict_note"), 300), case["kinds"])',
     '        conflicts = out.get("conflicts_detected") is True'),
    ("an unnamed conflict counts on the record",
     '    conflicts = _conflict_named(r.get("conflicts"), notes["conflict_note"], case["kinds"])',
     '    conflicts = r.get("conflicts") is True'),
    ("the panel is not told a shown failure decides", '"that establishes a requirement is not met decides it: evidence_sufficient is then true. Set it false "',
     '"that leaves some requirement open is insufficient. Set it false "'),
    ("an appeal with nothing new is judged again",
     '        if not self._brought(c):\n            _refuse("the appellant filed no new evidence',
     '        if False:\n            _refuse("the appellant filed no new evidence'),
    ("anyone's evidence counts as the appellant's",
     '        return any(_seq(e) > int(a["mark"]) and self._item(e)["role"] == a["by"] for e in self._items(c["claim_id"]))',
     '        return any(_seq(e) > int(a["mark"]) for e in self._items(c["claim_id"]))'),
    ("evidence from before the appeal counts",
     '        return any(_seq(e) > int(a["mark"]) and self._item(e)["role"] == a["by"] for e in self._items(c["claim_id"]))',
     '        return any(self._item(e)["role"] == a["by"] for e in self._items(c["claim_id"]))'),
    ("an empty appeal waits three days to close", "            empty = not self._brought(c)", "            empty = False"),
    ("an appeal closes inside its evidence period",
     '            if now <= ends:\n                _refuse("the appeal\'s evidence period is still open")',
     '            if False:\n                _refuse("the appeal\'s evidence period is still open")'),
    ("the record keeps the leader's own seen flags", '        ob["seen"] = ob["evidence_id"] in seen_ids', "        pass"),
    ("an unseen photograph grounds a finding",
     '    return {e: k for e, k in kinds.items() if k not in ("IMAGE", "SCAN") or e in seen}',
     "    return dict(kinds)"),
    ("validators check only the leader's raw answer",
     '            why = _dissent(theirs, mine, ids) or _dissent(_settle_result(theirs, case), mine, ids)',
     "            why = _dissent(theirs, mine, ids)"),
    ("validators check only the answer as it would be recorded",
     '            why = _dissent(theirs, mine, ids) or _dissent(_settle_result(theirs, case), mine, ids)',
     "            why = _dissent(_settle_result(theirs, case), mine, ids)"),
    ("a leader that skipped a requirement is followed",
     '    if any(tr.get(i) not in REQUIREMENT_STATUSES for i in ids):', "    if False:"),
    ("S21: a rejection binds nothing",
     '                                       else [i for i, s in ratings.items() if s == "NOT_SATISFIED"]',
     "                                       else []"),
    ("the leader's notes are stored unclean",
     '    notes = _clean_notes(r.get("notes"), ids, len(case["images"]))',
     '    notes = dict(r.get("notes") or {}, basis=_clean_notes(r.get("notes"), ids, 9)["basis"])'),
    # ── what each node sees (S31, S39) ─────────────────────────────────────
    ("the examination is shown the filer's description",
     "        lines = [f\"Image {n} occupies the {it['view'].lower().replace('_', ' ')} slot\"",
     "        lines = [f\"Image {n} occupies the {it['view'].lower().replace('_', ' ')} slot; the filer "
     "says: {it.get('description', '')}\""),
    ("S31: the panel is not told labels are claims", r'"claim, never for it.\n"', r'"claim.\n"'),
    ("party text can name a fence's end", '    return _MARKER.sub(lambda m: m.group(1) + "_" + m.group(3), t)',
     "    return t"),
    ("a party field sits outside any fence", '    return f"<<<{label}: {_fence(text)}>>>"', "    return _fence(text)"),
    ("before photographs are not paired first",
     '        images.sort(key=lambda p: (order.get(p[0]["role"], 3), 0 if p[0]["view"] == "BEFORE" else 1,',
     '        images.sort(key=lambda p: (order.get(p[0]["role"], 3), 1,'),
    ("three images go to one prompt", "IMAGES_PER_PROMPT = 2", "IMAGES_PER_PROMPT = 3"),
    # ── evidence (S35, S39) ─────────────────────────────────────────────────
    ("S35: the same bytes count twice",
     '            if self._item(e)["content_hash"] == digest:', "            if False:"),
    ("EXIF JPEGs reach the validators",
     r'        if not (head[:8] == b"\x89PNG\r\n\x1a\n" or (head[:4] == b"\xff\xd8\xff\xe0" and head[6:11] == b"JFIF\x00")):',
     "        if False:"),
    ("four bytes pass for a PNG signature", r'head[:8] == b"\x89PNG\r\n\x1a\n"', r'head[:4] == b"\x89PNG"'),
    ("a JPEG without its JFIF name passes", r' and head[6:11] == b"JFIF\x00")', ")"),
    ("an oversize image is stored", "        if len(data) > MAX_IMAGE_BYTES:", "        if False:"),
    ("the claimant's photo quota is unbounded",
     "        elif len(in_bucket) >= QUOTAS[role][bucket]:", "        elif False:"),
    ("an appeal takes unlimited new evidence",
     "            if len(added) >= APPEAL_ADDITIONS[bucket]:", "            if False:"),
    ("evidence after the claim's deadline",
     '            if now > _parse_iso(c["evidence_ends"]):\n                _refuse("the claim\'s evidence period',
     '            if False:\n                _refuse("the claim\'s evidence period'),
    ("the sponsor files evidence against a claimant's appeal",
     '        elif appeal and appeal["by"] == "SPONSOR" and sender == c["sponsor"]:',
     '        elif appeal and sender == c["sponsor"]:'),
    ("preflight skipped", "        if gap:\n            _refuse(gap)", "        if False:\n            _refuse(gap)"),
    # ── money (S3, S17, S23, S24) ───────────────────────────────────────────
    ("S23: the benefit is not committed at filing",
     '            t["committed_wei"] = str(int(t["committed_wei"]) + benefit)', "            pass"),
    ("S23: a reserve that cannot cover the benefit takes the claim",
     "            if self._free(t) < benefit:", "            if False:"),
    ("the bond is not exact", '            if wei != int(v["bond_wei"]):', "            if False:"),
    ("a refused filing keeps the value",
     "        except Exception as e:\n            if wei:\n                self._credit(sender, wei)\n"
     "            return json.dumps({\"refused\": True, \"reason\": str(e).replace(ERROR_EXPECTED + \" \", \"\")\n"
     "                               + (\"; the value sent is credited back\" if wei else \"\")})\n\n    def _filer",
     "        except Exception as e:\n            return json.dumps({\"refused\": True, \"reason\": str(e)})\n\n"
     "    def _filer"),
    ("an established event pays nothing",
     "            self._credit(c[\"claimant\"], benefit + bond)", "            self._credit(c[\"claimant\"], bond)"),
    ("the reserve is not debited for a paid benefit",
     '            t["reserve_wei"] = str(int(t["reserve_wei"]) - benefit)', "            pass"),
    ("a forfeited bond is also credited to the claimant",
     '            t["forfeited_wei"] = str(int(t["forfeited_wei"]) + bond)',
     '            t["forfeited_wei"] = str(int(t["forfeited_wei"]) + bond)\n'
     '            self._credit(c["claimant"], bond)'),
    ("a lapsed claim returns the bond",
     '        elif determination in ("NOT_ESTABLISHED", "LAPSED"):', '        elif determination == "NOT_ESTABLISHED":'),
    ("settlement leaves the benefit committed",
     '        t["committed_wei"] = str(int(t["committed_wei"]) - benefit)', "        pass"),
    ("committed reserve can be withdrawn", "        if amount > self._free(t):", "        if False:"),
    ("withdraw pays and keeps the credit", '        row["owed"], row["paid"] = "0", str(int(row["paid"]) + owed)',
     '        row["paid"] = str(int(row["paid"]) + owed)'),
    ("a stranger funds the reserve",
     '            if sender != t["sponsor"]:\n                raise _PayableRefusal("only the sponsor funds', "            if False:\n"
     '                raise _PayableRefusal("only the sponsor funds'),
    ("a wallet holds unlimited open claims",
     "            if self._count(f\"open|{t['type_id']}|{sender}\") >= MAX_OPEN_PER_CLAIMANT:", "            if False:"),
    ("the open-claim counter never falls",
     "        self._bump(f\"open|{t['type_id']}|{c['claimant']}\", -1)", "        pass"),
    # ── parties (S35, S43) ─────────────────────────────────────────────────
    ("the sponsor claims under its own type", '            if sender == t["sponsor"]:\n                raise _PayableRefusal("the sponsor cannot',
     '            if False:\n                raise _PayableRefusal("the sponsor cannot'),
    ("an assessor claims under the type", '            if sender in v["assessors"]:', "            if False:"),
    ("the sponsor names itself assessor", '        if addr == sponsor:', "        if False:"),
    ("an unaccepted assessor is nominated",
     '                if assessor not in v["assessors"] or not self._accepted(t["type_id"], assessor):',
     '                if assessor not in v["assessors"]:'),
    ("anyone accepts an assessor role",
     '        if sender not in self._version(t["type_id"], t["version"])["assessors"]:', "        if False:"),
    ("a required assessor is optional", '            if v["assessor_required"] and not assessor:', "            if False:"),
    ("anyone asks for the assessment",
     '        if self._sender() != c["claimant"]:\n            _refuse("only the claimant requests',
     '        if False:\n            _refuse("only the claimant requests'),
    ("the claimant appeals an established event",
     '            if sender != c["sponsor"]:\n                _refuse("only the sponsor appeals',
     '            if False:\n                _refuse("only the sponsor appeals'),
    ("the sponsor appeals a failed claim",
     '            if sender != c["claimant"]:\n                _refuse("only the claimant appeals',
     '            if False:\n                _refuse("only the claimant appeals'),
    ("anyone withdraws a claim",
     '        if self._sender() != c["claimant"]:\n            _refuse("only the claimant withdraws',
     '        if False:\n            _refuse("only the claimant withdraws'),
    # ── windows and the machine (S1, S13, S17, S26) ─────────────────────────
    ("a future event date is accepted", "            if event_day > now.date():", "            if False:"),
    ("the filing window is not enforced",
     '            if now.date() > event_day + timedelta(days=int(v["filing_window_days"])):', "            if False:"),
    ("a paused type takes claims", '            if t["state"] != "ACTIVE":', "            if False:"),
    ("finalize inside the appeal window",
     '        if d["appeals_left"] > 0 and _now() <= _parse_iso(d["appeal_window_ends"]):', "        if False:"),
    ("an appeal after the window", '        if now > _parse_iso(d["appeal_window_ends"]):', "        if False:"),
    ("appeals are unlimited", '        if d["appeals_left"] <= 0:', "        if False:"),
    ("a used appeal is not counted", '        c["appeals_used"] = int(c["appeals_used"]) + 1', "        pass"),
    ("a readjudication before the other side can answer",
     '        if _now() <= _parse_iso(a["evidence_ends"]):\n            _refuse("the appeal\'s evidence period is still open',
     '        if False:\n            _refuse("the appeal\'s evidence period is still open'),
    ("a photographed document counts as an observation",
     '                if it["view"] == "DOCUMENT_SCAN":\n                    kinds[eid] = "SCAN"',
     '                if False:\n                    kinds[eid] = "SCAN"'),
    ("a scan alone passes the photograph gate",
     '        if not any(it["kind"] == "IMAGE" and it["view"] != "DOCUMENT_SCAN" for it in items):',
     '        if not any(it["kind"] == "IMAGE" for it in items):'),
    ("a lapsing claim is withdrawn for its bond",
     '        if _now() > _parse_iso(c["evidence_ends"]):\n            _refuse("the evidence period has ended; the claim can only',
     '        if False:\n            _refuse("the evidence period has ended; the claim can only'),
    ("an open claim closes before its deadline",
     '            if now <= _parse_iso(c["evidence_ends"]):\n                _refuse("the claim\'s evidence period has not',
     '            if False:\n                _refuse("the claim\'s evidence period has not'),
    ("an appeal with evidence closes as stale at once",
     "            if not empty and now <= ends + timedelta(seconds=STALE_APPEAL_SECONDS):",
     "            if not empty and now <= ends:"),
    ("the superseded determination is not marked", '        prior["lifecycle"] = "SUPERSEDED"', "        pass"),
    ("the assessment runs after the evidence deadline",
     '        if _now() > _parse_iso(c["evidence_ends"]):\n            _refuse("the claim\'s evidence period has ended; the',
     '        if False:\n            _refuse("the claim\'s evidence period has ended; the'),
    ("a version changes the event kind",
     '        if v["category"] != t["category"] or v["event_kind"] != t["event_kind"]:', "        if False:"),
    ("an open claim follows the newest version",
     '        v = self._version(c["type_id"], c["type_version"])\n        images, texts',
     '        v = self._version(c["type_id"], self._type(c["type_id"])["version"])\n        images, texts'),
]


def run(work: pathlib.Path) -> tuple:
    r = subprocess.run([sys.executable, "-m", "pytest", "tests/direct/", "-q", "-x", "--tb=no",
                        "-p", "no:cacheprovider"],
                       cwd=work, capture_output=True, text=True, check=False)
    tail = [ln for ln in r.stdout.splitlines() if ln.strip()][-1:] or [""]
    return r.returncode == 0, tail[0]


def main() -> int:
    only = sys.argv[1:]
    chosen = [m for m in MUTATIONS if not only or any(o in m[0] for o in only)]
    survivors = []
    with tempfile.TemporaryDirectory(prefix="occurra-mutants-") as tmp:
        work = pathlib.Path(tmp)
        shutil.copytree(REPO / "contracts", work / "contracts")
        shutil.copytree(REPO / "tests", work / "tests", ignore=shutil.ignore_patterns("__pycache__", "mutation"))
        shutil.copy(REPO / "pyproject.toml", work / "pyproject.toml")
        # The fixture-drift test compares the contract's records with the app's fixtures.
        shutil.copytree(REPO / "web" / "tests" / "fixtures", work / "web" / "tests" / "fixtures")
        target = work / "contracts" / "occurra.py"
        for entry in chosen:
            name = entry[0]
            edits = entry[1] if isinstance(entry[1], list) else [(entry[1], entry[2])]
            if any(TEXT.count(old) != 1 for old, _ in edits):
                print(f"SKIPPED  {name}: a target is missing or repeated", flush=True)
                survivors.append(name)
                continue
            mutant = TEXT
            for old, new in edits:
                mutant = mutant.replace(old, new)
            target.write_text(mutant, encoding="utf-8", newline="\n")
            passed, tail = run(work)
            print(f"{'SURVIVED' if passed else 'killed  '} {name}  ({tail})", flush=True)
            if passed:
                survivors.append(name)
        target.write_text(TEXT, encoding="utf-8", newline="\n")
        passed, tail = run(work)
    print(f"control, the contract as written: {'passes' if passed else 'FAILS'} ({tail})")
    print(f"{len(chosen) - len(survivors)}/{len(chosen)} mutants killed")
    if survivors:
        print("survivors: " + "; ".join(survivors))
    return 0 if passed and not survivors else 1


if __name__ == "__main__":
    sys.exit(main())
