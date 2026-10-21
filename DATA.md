# Text sources and credits

## Books and stories

From the [Project Ben-Yehuda public domain dump](https://github.com/projectbenyehuda/public_domain_dump), the plain text files without nikud (`txt_stripped`).

The works are in the public domain. The project asks for credit: **Project Ben-Yehuda volunteers, https://benyehuda.org**.

Any app built from these texts should show that credit.

## Articles

From Hebrew Wikipedia, fetched with its API as plain text.

These are licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Each article needs a credit and a link to its page. Anything we build from these articles must be shared under the same license.

The article files in `data/raw/articles/` are stored as `{pageid}.json`. The page is at `https://he.wikipedia.org/?curid={pageid}`.

## Word frequencies, used to rate how hard each text is

From [FrequencyWords by hermitdave](https://github.com/hermitdave/FrequencyWords), the Hebrew list built from OpenSubtitles (`content/2018/he/he_50k.txt`). Code is MIT. The word list is CC BY-SA 4.0.

We compare each text against this list to measure how many of its words are uncommon. The list itself is in `data/freq/`. Only the resulting ratings are shown in the app.
