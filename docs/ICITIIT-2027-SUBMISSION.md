# ICITIIT'27 submission notes (checked 2026-10-15)

Conference: 8th International Conference on Innovative Trends in Information Technology, IIIT Kottayam,
19-20 Feb 2027, in person, technically co-sponsored by IEEE Kerala Section.
Theme: "Beyond Generative AI: Engineering Intelligent, Trustworthy, Autonomous, and Responsible Computing Systems".

## What the site states (icitiit27.iiitkottayam.ac.in)

| Item | Value |
|---|---|
| Submission deadline | **20 Oct 2026, 11:59 PM IST** |
| Notification / camera-ready | 20 Dec 2026 / 10 Jan 2027 |
| Submission system | Microsoft CMT: https://cmt3.research.microsoft.com/ICITIIT2027 (needs a CMT account) |
| Publication | "Accepted and presented papers will be submitted for possible publication in IEEE Xplore" |
| Page limit | Registrations page: max 8 pages; over 6 pages costs INR 1,000 per page (USD 20 foreign) |
| Registration | Full Author registration is mandatory for IEEE Xplore. Student author fee INR 6,000 (IEEE member) / 7,000 (non-member) if paid by 16 Dec 2026 |
| Refunds | None once a paper is accepted and registered |

Tracks that fit DreamOS: (2) Data Science, Knowledge Engineering, and Predictive Analytics; (5) Secure,
Privacy-Preserving, and Quantum Computing Technologies; (1) Foundation AI, Machine Learning, and Intelligent
Computing Systems. Pick track 2 or 5 in CMT.

## What the site does NOT state (ask icitiit27@iiitkottayam.ac.in, note the page's mailto says icitiit26@)

- Template, review model (single or double blind), plagiarism limit, **AI policy**. None of these appear on
  the 2027 pages, and the ICITIIT'25 pages (author and camera-ready) also have no AI policy.
- The 2027 dates page and registrations page disagree (early registration 10 Jan vs 16 Dec). Confirm.

## What the ICITIIT'25 author pages said (use as the working rules until the chairs say otherwise)

- "Use only IEEE standard two column conference paper template".
- "The maximum length of the paper for review is 6 pages including references."
- PDF, at most 10 MB, no encryption or password.
- "Papers having poor quality and/or high similarity index will be desk rejected (without review)."
- Camera-ready: similarity below 30% (Turnitin or similar), IEEE PDF eXpress compatible PDF with the
  conference ID, within 6 pages (up to 8 with the extra-page charge).

## AI policy

The conference publishes none. The publisher does: for IEEE publications, AI-generated content (text,
figures, code) must be disclosed in the Acknowledgments, naming the AI system, the parts it was used for
and the level of use; AI tools cannot be authors; authors remain responsible. This was confirmed from
secondary IEEE-society pages, so confirm it with the chairs or the IEEE Author Center before submitting.

This paper was drafted and its analysis code written with an AI assistant, so the disclosure applies.
Four builds exist, all 6 pages:

| File | Names | AI disclosure |
|---|---|---|
| `DreamOS-IEEE-Paper.pdf` | yes | no |
| `DreamOS-IEEE-Paper-AI-disclosed.pdf` | yes | yes (Acknowledgment) |
| `DreamOS-IEEE-Paper-Anonymous.pdf` | no | no |
| `DreamOS-IEEE-Paper-Anonymous-AI-disclosed.pdf` | no | yes |

Recommendation: submit an AI-disclosed build. Review model is unstated, so if CMT or the chairs say
double-blind, use the Anonymous one.

## How this paper compares with what ICITIIT accepted

- ICITIIT'26: 1,171 submissions, 159 presented (about 14%) per Onmanorama. Treat acceptance as competitive.
- ICITIIT'25 presentation schedule (16 sessions of 5 to 7 papers): mostly applied deep learning and
  vision (skin, leaf and disease detection, gesture, traffic), IoT and cryptography. Few papers are about
  retrieval or knowledge systems and only a handful mention generative AI. Titles are system-style
  ("NaviNest - A Virtual Assistant", "PharmaPlus - GenerativeAI Chatbot").
- Where DreamOS differs: it is a system paper like these, but with a labelled comparison against baselines
  with intervals, a measured trust guard, profiled performance fixes and listed failures, which most
  accepted titles do not suggest. The theme ("Trustworthy", "Responsible", "Beyond Generative AI") is
  what the 2027 build was reframed around.
- Honest weak points a reviewer will see: 36 queries on a 37-file vault written by the authors; baselines
  are our reference implementations; scale data is synthetic; novelty is engineering and evaluation, not a
  new algorithm. These are all stated in the paper.

## Before 20 Oct

1. Create the CMT account, confirm template/review/AI policy by email (one short message to the chairs).
2. Pick the build (above), open the PDF once to check names, and upload.
3. Do not register or pay until acceptance (20 Dec); plan the INR 6,000 to 7,000 student fee then.
4. Guide and RM faculty approval first, then submission proof to the RM faculty.
