/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

"use strict";

module.metadata = {
  "stability": "experimental"
};

const { Ci, Cc, Cr } = require("chrome");
const { defer } = require("../core/promise");
const { data } = require("../self");
const { readURI } = require("../net/url");

const ios = Cc['@mozilla.org/network/io-service;1']
          .getService(Ci.nsIIOService);
const parser = Cc["@mozilla.org/parserutils;1"]
          .getService(Ci.nsIParserUtils);

const ALLOWED_NODES = ["BUTTON"];

let filters = {
  "childList": function childList(node) {
    if (node.nodeType === 3 && node.parentNode)
      node = node.parentNode;

    if (node.nodeType === 1)
      return ~ALLOWED_NODES.indexOf(node.tagName);

    return false;
  }
}

let addonPageURI = ios.newURI(data.url("main.html"), null, null);

try {
  ios.newChannelFromURI(addonPageURI).open().close();
} catch (e if e.result === Cr.NS_ERROR_FILE_NOT_FOUND) {
  addonPageURI = "about:blank";
};

let observers = new WeakMap();

function load(document) {
  let { promise, resolve, reject } = defer();

  let { MutationObserver } = document.defaultView;

  let observer = observers.get(document);

  if (observer)
    observer.disconnect();

  observer = new MutationObserver(function(mutations) {
    for (let mutation of mutations) {
      let { type } = mutation;

      switch (type) {
        case "childList":
          let addedNodes = Array.filter(mutation.addedNodes, filters[type]);
          let removedNodes = Array.filter(mutation.removedNodes, filters[type]);

          break;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true
  });

  observers.set(document, observer);

  readURI(addonPageURI.spec).then(function(html) {

    let fragment = parser.parseFragment(
      html,
      parser.SanitizerAllowStyle,
      false,
      addonPageURI,
      document.body
    );

    document.body.appendChild(fragment);

    resolve();
  }, reject);

  return promise;
}
exports.load = load;
