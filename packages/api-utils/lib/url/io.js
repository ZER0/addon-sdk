/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Ci, Cu, Cr, components } = require("chrome");
const { defer, resolve, reject } = require("../promise");
const { merge } = require("../utils/object");

const { NetUtil } = Cu.import("resource://gre/modules/NetUtil.jsm", {});

/**
 * Reads a channel synchronously with the charset given, and returns a resolved
 * promise.
 */
function readChannel(channel, charset) {
  let stream;

  try {
    stream = channel.open();
  }
  catch (e) {
    let uri = channel.originalURI.spec;
    return reject("Failed to read: '" + uri + "' (Error Code: " + e.result + ")");
  }

  let count = stream.available();
  let data = NetUtil.readInputStreamToString(stream, count, { charset : charset });

  stream.close();

  return resolve(data);
}

/**
 * Reads a channel asynchronously with the charset given, and returns a promise.
 */
function readChannelAsync(channel, charset) {

  let { promise, resolve, reject } = defer();
  let data = "";

	channel.asyncOpen({
	  onStartRequest: function(request, context) {},

	  onDataAvailable: function(request, context, stream, offset, count) {
      data += NetUtil.readInputStreamToString(stream, count, { charset : charset });
	  },

	  onStopRequest: function(request, context, result) {
	    if (components.isSuccessCode(result)) {
        resolve(data);
      } else {
        let uri = channel.originalURI.spec;
        reject("Failed to read: '" + uri + "' (Error Code: " + result + ")");
      }
    }
  }, null);

  return promise;
}

/**
 * Reads a URI and returns a promise. If the `sync` option is set to `true`, the
 * promise will be resolved synchronously.
 *
 * @param uri {string} The URI to read
 * @param [options] {object} This parameter can have any or all of the following
 * fields: `sync`, `charset`. By default the `charset` is set to 'UTF-8'.
 *
 * @example
 *  let promise = readURI('resource://gre/modules/NetUtil.jsm', {
 *    sync: true,
 *    charset: 'US-ASCII'
 });
 */
function readURI(uri, options) {
  options = merge({
    charset: "UTF-8",
    sync: false
  }, options);

  let channel = NetUtil.newChannel(uri, options.charset, null);

  return options.sync 
    ? readChannel(channel, options.charset)
    : readChannelAsync(channel, options.charset);
}

exports.readURI = readURI;
