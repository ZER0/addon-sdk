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

const GENERIC_IMAGE = "chrome://mozapps/skin/extensions/extensionGeneric-16.png";

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
let mappedNodes = new WeakMap();
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

let getHTMLNodeFor = function(xulNode) mappedNodes.get(xulNode) || null;

function clickDispatcher(event) {
  let button = getHTMLNodeFor(this);
  let document = button.ownerDocument;

  if (button) {
    let clickEvent = document.createEvent("MouseEvents");

    clickEvent.initMouseEvent("click", true, true, document.defaultView,
      event.detail, event.screenX, event.screenY, event.clientX, event.clientY,
      event.ctrlKey, event.altKey, event.shiftKey, event.metaKey,
      event.button,
      null
    );

    return button.dispatchEvent(clickEvent);
  }
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

  toolbarbutton.addEventListener("command", clickDispatcher);

  container.appendChild(toolbarbutton);
  mappedNodes.set(toolbarbutton, node);
}

function destroyToolbarButton(node) {
  let window = getMostRecentBrowserWindow();

  let toolbarbutton = window.document.getElementById(buttonPrefix + node.id)

  if (toolbarbutton && toolbarbutton.parentNode) {
    toolbarbutton.parentNode.removeChild(toolbarbutton);

    mappedNodes.delete(toolbarbutton);
  }
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

  let { MutationObserver } = document.defaultView;

  let observer = observers.get(document);

  if (observer)
    observer.disconnect();

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
