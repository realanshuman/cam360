# Cam360 SEO and AEO plan

Written September 2026. Based on three research passes (keyword and SERP,
answer engines, Chrome Web Store and distribution) plus a local audit of
`web/`. Claims are tagged where confidence varies. Read the caveats at the
bottom before treating any number here as fact.

---

## 1. Where we are

Measured from the source files and from live searches.

| Signal | State |
| --- | --- |
| Brand visibility | Zero. Searching `Cam360` returns nothing about this product. |
| Site size | 813 words of visible copy across one page plus `/privacy`. |
| Structured data | None on any page. |
| Title and H1 | Lead with an unknown brand. No searchable term in either. |
| FAQ content | All four answers collapsed inside `<details>`. |
| Sitemap | Lists `/` only. No `/privacy`, no `lastmod`. |
| Images | 450KB of PNG. `og.png` 158KB, `panel.png` 134KB. |
| Store listing | Title is `Cam360`. Zero keywords in the highest weighted field. |
| GitHub repo | 1 star, no description, no topics. Homepage field is correct. |

Already correct: `lang="en"`, canonicals on both pages, descriptive alt text,
clean URLs, sane heading order, and a `robots.txt` that allows AI crawlers.

---

## 2. Decision one: the name

This is the first decision because everything else depends on it.

Two established entities already own the string `Cam360`:

- **CAM360 AmnioGraft**, a BioTissue ocular therapy, with trade press from
  June 2024 through January 2026 across Healio, Eyewire and Ophthalmology 360.
- **Camera360** by PinGuo, a mobile photo app claiming over 500 million users,
  present on the App Store, Google Play, Amazon and every APK mirror.

There is also a CAM360 iOS app and CCTV software using the name.

An answer engine asked about "Cam360" today has no reason to surface a Chrome
extension with one GitHub star. Two options:

**Option A, keep the name and always qualify it.** Never publish the bare
string. Always "Cam360, the Chrome extension for webcam effects" or
"Cam360 Chrome extension". Cheap, keeps the live store listing and its
approval, but you are permanently competing for your own name against a
medical device with real press.

**Option B, rename now.** Costly in that the store listing, site, repo and
icons all change, but the product is days old with almost no installs, so the
cost will never be lower than it is this week.

Recommendation: **Option A, with the title change in section 5.** The store
title fix moves the discoverable weight onto category words like "virtual
background" and "webcam effects" rather than the brand, which sidesteps most
of the collision without a rename. Revisit if the product grows and the name
keeps costing you.

---

## 3. What the research overturned

Do not spend time on these. Each was checked against evidence, not blog posts.

- **Schema does not buy AI citations.** A controlled experiment of 1,885 pages
  adding JSON-LD against roughly 4,000 matched controls (August 2025 to March
  2026) found no positive effect. The widely quoted correlation vanishes under
  control. Add schema for rich-result eligibility and entity disambiguation,
  budget two hours, expect nothing beyond that.
- **FAQPage rich results are gone.** They stopped appearing in May 2026,
  Search Console reporting was removed in June, the API in August. HowTo was
  deprecated earlier. Still worth emitting FAQ schema as machine-readable
  context, not as a route to a rich result.
- **llms.txt is not an adopted standard.** Across 137,000 domains, 97% of
  these files received zero requests, and AI retrieval bots were 1.1% of the
  requests that did occur. Skip it.
- **Google published official guidance in May 2026** naming six unnecessary
  tactics: llms.txt, content chunking, AI-specific rewriting, special schema,
  inauthentic mentions, over-engineered markup. Stated eligibility bar for AI
  Overviews and AI Mode is simply being indexed and snippet-eligible.
- **The B2B review-site playbook does not apply.** Searching this actual
  category surfaced Chrome Web Store listings, competitors' own sites, niche
  tool directories and AlternativeTo. Reddit, Product Hunt, G2, Capterra,
  Slant, StackShare, Wikipedia and YouTube were all absent from page one.

---

## 4. The finding that shapes the content work

A passage-level study across AI Overviews and Copilot found **owned brand
pages get quoted verbatim roughly 84% of the time, third-party listicles 0%**.
The typical quoted passage is around 25 tokens.

You are writing the sentence the engine will repeat. So every page follows one
pattern:

1. A question-shaped H2, phrased the way someone types it.
2. Immediately below it, a self-contained answer of 15 to 30 words with no
   pronouns that depend on surrounding context.
3. Then the elaboration.

The biggest structural constraint today is being one page. Query fan-out
retrieves against sub-questions, and one page can only be the best answer to
one of them.

**The honest limits are the best content.** Nobody else answers "does this
work with the Zoom desktop app" truthfully, or explains why background
replacement behaves differently on Google Meet. Those pages answer real
queries with no honest incumbent.

---

## 5. Chrome Web Store listing

The store page is the highest-leverage single asset. It ranks in Google *and*
in store search, and Google's own ranking sentence names **item name** first:
"Search ranking and recommendations are ordered based on the item name,
description relevancy, popularity, and user experience". There is no keywords
field. At current install counts every popularity signal is near zero, so text
relevance is the only lever available.

### Title

Limit is 75 characters, though search cards truncate around 40 to 45, so treat
45 as the working budget.

Current: `Cam360` (6 characters, zero keywords, and "360" misdirects toward
panoramic cameras).

Proposed, 43 characters:

```
Cam360: Virtual Background & Webcam Effects
```

"Virtual background" is the phrase Zoom and Meet teach users in their own
interfaces. This also becomes the `<title>` of the Google-indexed store page,
so one edit improves in-store rank and Google rank together.

### Summary

Limit is 132 characters. Current is 130, already at the cap.

Proposed, 123 characters:

```
Virtual background, background blur and webcam effects for any video call. Runs fully on your device. Free and open source.
```

Dropping the brand names from the summary sheds the entire trademark risk
surface and reclaims 35 characters for category terms.

### Trademark compliance

The governing document is the Chrome Web Store Branding Guidelines. It
requires compatibility claims to be phrased as "for", "for use with", or
"compatible with", to carry the trademark symbol, and to include attribution.

The current summary's "Works on Meet, Discord, Zoom" is none of those three
phrasings, omits the symbol, has no attribution, and bare "Meet" is worse than
"Google Meet" because it strips the disambiguator. This is not a takedown
risk, but the Impersonation policy's stated remedy is that Google "reserves
the right to reduce visibility" of items that potentially violate IP
protections, which is a silent ranking penalty.

Move compatibility into the description in the sanctioned form:

```
Works with browser based video calls, including Google Meet(TM), Discord, Zoom and Whereby.
```

Two hard limits to respect: do not list more than five supported brands, and
do not repeat any keyword more than five times (keyword stuffing has its own
rejection code).

### Accuracy disclosure

Store policy covers "the extension does not provide the functionality
described in the metadata". The current summary promises background swap on
Meet without qualification, but Meet's CSP blocks the AI model there and the
extension falls back to chroma key. Add one line to the description saying so.
This is both a policy safeguard and, per section 4, good AEO content.

---

## 6. GitHub repo

Verified against the GitHub API on 4 September 2026: 1 star, **no description
set**, and no topics. The `homepage` field is `fuckwebcam.xyz`, which is the
live production domain and therefore correct.

Actions, all one click each:

1. Write a description that reads as an answer: "Chrome extension that adds
   virtual backgrounds, background blur and webcam effects to any video call
   in your browser. Runs fully on device."
2. Add topics: `chrome-extension`, `webcam`, `virtual-background`,
   `background-blur`, `mediapipe`, `getusermedia`, `video-conferencing`,
   `privacy`, `manifest-v3`.
3. Cut a tagged release so there is a dated artifact.

GitHub repos rank well for open-source queries in this category, and every
open-source competitor found is Linux-only or an OBS plugin.

---

## 7. Target queries

### Pursue

| Cluster | Why it is winnable |
| --- | --- |
| Discord in the browser | Discord's blur is desktop-client only. Page one has off-intent results. |
| Chromebook and ChromeOS | Every desktop competitor is Windows or Mac. The "browser only" limit becomes the pitch. |
| Feature long tail (mirror, flip, rotate, zoom, brightness, name tag, snapshot, freeze) | Softest SERPs found. A 2017 post still holds page one. |
| "Why do I look bad on webcam" | No authority publishers on page one. |
| Chroma key in the browser without OBS | Unowned, and there is a real technical story behind it. |
| Teams web missing background effects | Live Microsoft forum threads plus stale 2021 IT pages. |
| Open source, no watermark, offline | The unoccupied ground. See below. |

### Skip, deliberately

- **All "X alternative" terms** for ManyCam, XSplit VCam, ChromaCam and Snap
  Camera. The intent is a desktop virtual camera this product cannot provide.
  Ranking there earns installs that become one-star reviews, which then damage
  the store ranking signals in section 5. This is a real cost, not just
  wasted effort.
- **"How to blur background in google meet".** Zapier, TechRepublic and Tom's
  Guide own page one, Meet ships the feature natively, and the AI path is
  CSP-blocked there specifically.
- **"Virtual background chrome extension" as a site page.** Page one is store
  listings. Win it through the store listing instead.
- **Whereby and Jitsi feature pages.** Both ship the feature natively.

### Positioning correction

"Local processing" is no longer a differentiator. GlowCam, SnapLens, FreezeCam
and FilterCam all claim it. **Open source is** the unoccupied position: every
open-source result in this category is Linux-only or an OBS plugin, and every
privacy marketer is closed-source freemium. Nobody holds open source plus
browser plus cross-platform plus free plus no account.

One product angle worth using: standalone webcam snapshot tools cannot capture
during a live call, because only one application can hold the camera. This one
can, because it sits inside the call's own stream.

---

## 8. Site work

### Phase 1, technical (no decisions needed)

- Rewrite `<title>` and meta description to lead with category terms.
- ~~Rewrite the H1 to carry a searchable term.~~ Declined, see Decisions.
- Add JSON-LD: `SoftwareApplication`, `WebSite`, `Organization`. Purpose is
  entity disambiguation given section 2, not rich results.
- Add `FAQPage` as machine-readable context only.
- Fix `sitemap.xml`: add `/privacy`, add `lastmod`.
- Add `og:site_name` and `og:locale`.
- Convert PNGs to WebP with PNG fallback.
- Restructure the FAQ so each answer leads with a self-contained 15 to 30 word
  response, per section 4.

### Phase 2, content pages

One page per retrievable sub-question. Suggested order, highest opportunity
first:

1. Virtual background for Discord in the browser
2. Webcam background blur on a Chromebook
3. Why you look bad on webcam, and what actually fixes it
4. Green screen in the browser without OBS
5. Mirror, flip and rotate your webcam
6. Does this work with desktop apps (the honest-limits page)
7. Why background replacement behaves differently on Google Meet

Each follows the section 4 pattern and links back to the store listing.

### Phase 3, off-site

**Tier 1**: store listing fix, repo hygiene, own site pages.
**Tier 2**: AlternativeTo (particularly adding Cam360 as an alternative on
competitor pages, since Snap Camera is dead and the paid desktop apps leave
"alternative" queries converting), named awesome-lists, Brave Search
submission (underexploited, and Claude's retrieval runs on Brave's independent
index), Bing Webmaster Tools plus IndexNow, and a demo video (the store
listing's Promotional Video field is currently empty and the asset gets reused
everywhere).
**Tier 3**: Show HN (the getUserMedia interception is a real hook), three or
four subreddits, Product Hunt.

**Wasted effort**: submitting to chrome-stats, crx4chrome, softonic and
similar, since they scrape automatically. Also AI tool directories, cold
outreach to roundup blogs, G2 and Capterra (wrong buyer), Slant, StackShare,
and Wikipedia (the notability bar is not met and self-creation is a conflict
of interest likely to be deleted).

Localization was flagged as the biggest untapped lever, outranking most of
Tier 2.

---

## 8b. One note on the domain

The site is served from `fuckwebcam.xyz`. Two factual consequences for this
plan, neither of which is a blocker:

- "Non family friendly content" appears on the Chrome Web Store's exclusion
  list for the Featured badge, and several curated lists and awesome-lists
  screen submissions on the same basis. That mainly affects Tier 2 and Tier 3
  in section 8, not indexing or ranking.
- A custom domain is better for SEO than the `vercel.app` subdomain it
  replaced, because a shared subdomain carries no independent authority. That
  part is a straightforward improvement.

If the domain is ever changed, the swap points are: `web/index.html`
(canonical, `og:url`, `og:image`, `twitter:image`, and five URLs in the JSON-LD
graph), `web/privacy.html` (canonical), `web/sitemap.xml`, `web/robots.txt`,
`README.md`, both files in `.github/ISSUE_TEMPLATE/`, and the Homepage and
Privacy policy fields in the Chrome Web Store dashboard.

---

## 9. Measurement

Nothing here is measurable today because nothing is verified as indexed.
Set up first, then act:

1. Google Search Console, verify the domain, submit the sitemap.
2. Bing Webmaster Tools, plus IndexNow for immediate submission.
3. Brave Search submission.
4. Track: impressions and clicks per query cluster from section 7, store
   listing impressions and install-to-uninstall ratio, and periodic manual
   checks of whether answer engines mention the product for the target
   questions.

Expect nothing for the first several weeks. A new domain with one page and a
new store listing has no history for any engine to weigh.

---

## Decisions taken

Recorded so the reasoning is not re-litigated later.

**The H1 and hero lede stay as they were.** The proposed replacement was
"Virtual backgrounds for any video call in your browser." It was reverted. The
`<title>` tag carries the ranking weight and it was changed; H1 is a much
weaker signal and pages rank without a keyword in it. The only thing forgone is
that a visitor arriving from a category search does not see matching words
immediately. Everything invisible to visitors (title, meta description, social
tags, JSON-LD, sitemap) was kept.

**Search engine submission is not being done for now.** Section 9 stands as a
recommendation rather than a completed step. Worth knowing what that defers:
a new domain with no inbound links can take weeks or months to be discovered,
Search Console is the only way to see whether the site is indexed or which
queries it appears for, and per section 3 the eligibility bar for AI Overviews
is simply being indexed. Nothing else in this plan can be measured until it is
done.

The FAQ copy on the landing page was kept, because the visible text has to
match the `FAQPage` markup word for word for the markup to be legitimate.

---

## Caveats

- **No search volume data exists in this plan.** The research had no keyword
  tool. Every demand statement is an inference from competitive intensity and
  is labelled as such in the source notes.
- **No install counts, ratings or review volumes are verified.** The Chrome
  Web Store, chrome-stats and several competitor sites are blocked by the
  sandbox's egress proxy. Competitor figures came from search snippets.
- **The live site could not be fetched** from the research environment, so the
  audit is from the repository source, not from the deployed page.
- Specific AI citation-share percentages are unverified and contradict each
  other across sources. Reddit is reported at both 40% and 3.8% depending on
  whether the metric is "appeared in an answer" or "share of citations".
- Update recency is **not** a documented Chrome Web Store ranking factor,
  despite universal community claims to the contrary.
- Webex native-effects status and the random-video-chat query cluster were not
  researched.

Full research notes: `research-keywords.md`, `research-aeo.md`,
`research-aso.md` (session scratchpad, not committed).
