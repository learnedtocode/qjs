## q.js

This is a user script for https://8kun.top that adds features and fixes a bunch of 8kun bugs.

Based on the [original "q.js v2018.3-6.1" code](https://duckduckgo.com/?q=q.js+v2018.3-6.1) which has mostly disappeared but had the following features:

- A scroll bar on the right that shows an overview of the whole thread, with your posts and replies to your posts in yellow, and Q's posts in blue
- Navigate between your posts/replies to your posts and between Q posts with arrow buttons
- Post fading based on post counts (fade out very active posters)
- Simple image blacklist
- Show a graph of post frequency over time

This script keeps all of those features and adds some more:

- Add post numbers like `[#123]` (the 123rd reply in the thread) to every post
- Mark lb/pb posts with a different background color (light yellow by default)
- Click anywhere in the scroll bar to jump to that post
- Better image blacklist - click the "hide" link above a post to collapse it and never show any of the images in that post again
- Fix 8kun auto-updates when a thread is getting towards the end
- Do not scroll to your own posts after posting, just show a notification link instead
- Add spaces between 3-digit groupings in post numbers to make them easier to read
- Fix broken images in the "flags" section of a post when you make a new post
- Show author info for qanonbin pastes in the thread
- Collapse the boards list in the top bar
- Better default settings for other boards like /qrb/
- Better settings system (see "Settings" below)

More features planned to implement soon:

- Better post filtering system - select text and click "filter" to add a filter
- Make links clickable again in /qresearch/
- Fix/improve the post rate graph

### How to install this

**Read the code first** or at least get some other anons to read it. Don't install random scripts that you haven't read into your 8kun settings, since they could spam the site on your behalf, steal your IP or read all of your previous posts!

This script doesn't do any of that but if you aren't sure how to tell for yourself then you should think twice about using it.

From any 8kun page, click `[Options]` at the top right of the page. Then go to the "User JS" tab and paste in the code for this script. You can always find the latest version here:

https://raw.githubusercontent.com/learnedtocode/qjs/master/q.js

### Settings

There are a lot of settings that you can override without modifying the script's code itself.

You can see a full list of supported settings here: https://github.com/learnedtocode/qjs/blob/master/q.js#L6

In order to change the settings you put some special code BEFORE the script code, in the same "User JS" tab in the 8kun options. Here is an example:

```js
window.qjsSettings = {
  youcolor: '#ffffbb',
};

// BEGIN Q.JS CODE
// MODIFICATIONS BELOW THIS LINE NOT RECOMMENDED!
// (... rest of q.js code below)
```

You can also override settings for specific boards:

```js
window.qjsSettings = {
  youcolor: '#ffffbb',
  boards: {
    qrb: {
      youcolor: '#334455',
    },
  },
};

// BEGIN Q.JS CODE
// MODIFICATIONS BELOW THIS LINE NOT RECOMMENDED!
// (... rest of q.js code below)
```

It's better to change the settings this way, WITHOUT modifying this script's code, because that way it's easier for you to update to new versions of the script later!

If there's a feature that you'd like to disable let us know in the [issues](https://github.com/learnedtocode/qjs/issues) or on the [8kun thread for this project](https://8kun.top/comms/res/21036.html) and we'll add a setting to let you disable it.
