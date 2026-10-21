# Confluence 2027 CMT paste sheet (prepared 2026-10-21)

Submission: https://cmt3.research.microsoft.com/Confluence2027 (deadline 4 Dec 2026; submit today per the guide).
Venue: Confluence 2027, Amity University Uttar Pradesh, Noida, 21 to 22 Jan 2027, IEEE Conference Record #71526. Double-blind.
The CMT account (create or log in) is Zaid's step; I cannot do it.

## Title

DreamOS: Trustworthy Semantic File Management with Local Models and a Checkable Privacy Audit

## Abstract (224 words)

Personal file collections are organised by names chosen at save time, and those names rarely describe the content later. Language-model assistants can search by meaning, but they can also launch the wrong file, follow a mistaken guess, or send data off the machine without the user knowing. We present DreamOS, a locally run desktop file manager that finds, opens, relates and organises files from natural-language requests using a local embedding model and a local 3B language model, with four explicit trust mechanisms: a confidence guard on the open action, evidence-before-model precedence for follow-ups, reversible organisation and a privacy audit that can be falsified. On 36 author-written queries over a 37-file vault, DreamOS ranks the intended file first for 94% of queries (MRR 0.97) against 56% for a BM25 content index and 33% for filename matching (paired exact test, p < 0.001); on the 10 queries sharing no word with their target, both lexical baselines score 0.00 and DreamOS 0.80. Opening the top result unconditionally would launch 2 wrong files; the guarded action launches 29 files, all correct, at the cost of 5 extra confirmations. On synthetic collections of 500 to 5,000 files, replacing three all-pairs loops cut the graph rebuild from 143.3 s to 3.2 s at 5,000 files. The query set is small and in-sample to the vault; limitations are stated in full.

(Verified: identical to the leadIn("Abstract", ...) template in docs/paper/build_paper.js after the
numbers are filled in; the PDF text was compared ignoring whitespace and hyphenation.)

## Keywords

trustworthy AI, semantic search, sentence embeddings, knowledge graph, local language models, privacy by design, responsible computing

## Subject areas to tick

Artificial Intelligence and Machine Learning Applications; Natural Language Processing; Cybersecurity, Privacy and Secure Cloud Frameworks; Software Engineering

## Authors (as printed in the paper)

| Name | Email |
|---|---|
| Zaid Ali Syed | sidzaid72@gmail.com |
| Om Vyas | vyasom100@gmail.com |
| Krushna Kadam | kadamkrushna412005@gmail.com |
| Minakshi R. Rajput | mrajput@mgmu.ac.in |

Affiliation: Department of Information Technology, Institute of Information and Communication Technology (IICT), MGM University, Chhatrapati Sambhajinagar, India

Note: the printed author block (Roll No. lines and "Under the guidance of Dr. Minakshi R. Rajput") is a college-report block, not an IEEE one. It needs Zaid's answer on emails and guide co-authorship before upload.

## File to upload

C:/Users/Asus/projects/DreamOS/docs/paper/DreamOS-IEEE-Paper-Anonymous-AI-disclosed.pdf
Size 485,440 bytes (0.49 MB, limit 10 MB), 6 pages (Confluence allows 5 to 6), not encrypted. Anonymous (double-blind): no author names, e-mails or affiliation in the text.

Template pass 2026-10-21: IEEE conference typography applied (24 pt title, 11 pt authors, bold 9 pt abstract, small-caps headings, no page numbers)
