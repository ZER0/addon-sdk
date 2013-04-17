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
const { data, id: addonID } = require("../self");
const { readURI } = require("../net/url");
const { getMostRecentBrowserWindow } = require("../window/utils");

const ios = Cc['@mozilla.org/network/io-service;1']
          .getService(Ci.nsIIOService);
const parser = Cc["@mozilla.org/parserutils;1"]
          .getService(Ci.nsIParserUtils);

const ALLOWED_NODES = ["BUTTON"];
const ALLOWED_ATTR = ["style", "disabled"];
const ALLOWED_STYLE = ["backgroundImage"];

const EVENT_TYPE = {
  "click": "command"
}

const GENERIC_IMAGE = "chrome://mozapps/skin/extensions/extensionGeneric-16.png"

const buttonPrefix = "button:" + addonID + "-";

function validElement(node) {
  return node && node.nodeType === 1 && node.id && ~ALLOWED_NODES.indexOf(node.tagName);
}

let filters = {
  "childList": function childList(node) {
    if (node.nodeType === 3)
      node = node.parentNode;

    return validElement(node);
  },
  "attributes": function attributes(node, attribute) {
    return validElement(node) && ~ALLOWED_ATTR.indexOf(attribute)
  }
}

let observers = new WeakMap();
let listeners = new WeakMap();
let addonPageURI = ios.newURI(data.url("main.html"), null, null);

try {
  ios.newChannelFromURI(addonPageURI).open().close();
} catch (e if e.result === Cr.NS_ERROR_FILE_NOT_FOUND) {
  addonPageURI = "about:blank";
};


function getImage(node) {
  let image = node.style.backgroundImage;

  if (image !== "none") {
    let matches = image.match(/url\(\"([^\"]+)\"\)/);

    if (matches) {
      return data.url(matches[1])
    }
  }

  return GENERIC_IMAGE
}

// just do that in current window for sake of semplicity: it's just a demo
function createToolbarButton(node) {
  let window = getMostRecentBrowserWindow();
  let container = window.document.getElementById("nav-bar");

  // don't care about currentset for now
  let toolbarbutton = window.document.createElement("toolbarbutton");

  toolbarbutton.setAttribute("label", node.textContent);
  toolbarbutton.className = "toolbarbutton-1";
  toolbarbutton.style.listStyleImage =  "url(" + getImage(node) + ")";
  // not check for duplicates yet
  toolbarbutton.id = buttonPrefix + node.id;

  container.appendChild(toolbarbutton);
}

function destroyToolbarButton(node) {
  let window = getMostRecentBrowserWindow();

  let toolbarbutton = window.document.getElementById(buttonPrefix + node.id)

  if (toolbarbutton && toolbarbutton.parentNode)
    toolbarbutton.parentNode.removeChild(toolbarbutton);
}

function addNode(node) {
  if (node.nodeType === 1)
    createToolbarButton(node);
  else if (node.nodeType === 3) {
    if (validElement(node.parentNode))
      updateTextContent(node.parentNode);
  }
}

function removeNode(node) {
  if (node.nodeType === 1)
    destroyToolbarButton(node);
  // don't take in account text node for the moment
}

function updateAttribute(node, attribute) {
  let window = getMostRecentBrowserWindow();

  let toolbarbutton = window.document.getElementById(buttonPrefix + node.id)

  switch (attribute) {
    case "style":
      // only backgroundImage is taken in account atm
      toolbarbutton.style.listStyleImage =  "url(" + getImage(node) + ")";
      break;
    case "disabled":
      toolbarbutton.disabled = node.disabled;
  }
}

function updateTextContent(node) {
  let window = getMostRecentBrowserWindow();

  let toolbarbutton = window.document.getElementById(buttonPrefix + node.id)
  toolbarbutton.setAttribute("label", node.textContent);
}

function load(document) {
  let { promise, resolve, reject } = defer();

  let { MutationObserver, HTMLButtonElement } = document.defaultView;

  let observer = observers.get(document);

  if (observer)
    observer.disconnect();

  let proto = HTMLButtonElement.prototype;
  let { addEventListener, removeEventListener } = proto;

  proto.addEventListener = function(type, listener, useCapture) {
    let { document } = getMostRecentBrowserWindow();

    let toolbarbutton = document.getElementById(buttonPrefix + this.id);

    if (toolbarbutton && EVENT_TYPE[type]) {
      let boundListeners = listeners.get(this);

      if (!boundListeners)
        listeners.set(this, boundListeners = new WeakMap());

      let boundListener = boundListeners.get(listener);

      if (!boundListener)
        boundListeners.set(listener, boundListener = listener.bind(this));

      toolbarbutton.addEventListener.call(toolbarbutton, EVENT_TYPE[type], boundListener, !!useCapture);
    }
  }

  proto.removeEventListener = function(type, listener, useCapture) {
    let { document } = getMostRecentBrowserWindow();

    let toolbarbutton = document.getElementById(buttonPrefix + this.id);

    if (toolbarbutton && EVENT_TYPE[type]) {
      let boundListeners = listeners.get(this);

      if (boundListeners) {
        let boundListener = boundListeners.get(listener);

        if (boundListener) {
          toolbarbutton.removeEventListener.call(toolbarbutton, EVENT_TYPE[type], boundListener, !!useCapture);
        }
      }

    }
  }

  observer = new MutationObserver(function(mutations) {
    for (let mutation of mutations) {
      let { type } = mutation;
      let filter = filters[type];

      switch (type) {
        case "childList":
          let addedNodes = Array.filter(mutation.addedNodes, filter);
          let removedNodes = Array.filter(mutation.removedNodes, filter);

          addedNodes.forEach(addNode);
          removedNodes.forEach(removeNode);

          break;
        case "attributes":
          if (filter(mutation.target, mutation.attributeName)) {
            updateAttribute(mutation.target, mutation.attributeName);
          }
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
