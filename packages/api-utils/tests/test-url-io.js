/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { readURI, readURISync } = require("api-utils/url/io");
const { data } = require("self");

const utf8text = "Hello, ゼロ!";
const latin1text = "Hello, ã‚¼ãƒ­!";

exports["test async readURI"] = function(assert, done) {
  let content = "";

  readURI(data.url("test-uri-io.txt")).then(function(data) {
    content = data;
    assert.equal(data, utf8text, "The URL content is loaded properly");
    done();
  }, function(){
    assert.fail("should not reject");
    done();
  })

  assert.equal(content, "", "The URL content is not load yet");
}

exports["test sync readURI"] = function(assert) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { sync: true }).then(function(data) {
    content = data;
  }, function(){
    assert.fail("should not reject");
  })

  assert.equal(content, utf8text, "The URL content is loaded properly");
}

exports["test readURISync"] = function(assert) {
  let content = readURISync(data.url("test-uri-io.txt"));

  assert.equal(content, utf8text, "The URL content is loaded properly");
}

exports["test async readURI with ISO-8859-1 charset"] = function(assert, done) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { charset : "ISO-8859-1"}).then(function(data) {
    content = data;
    assert.equal(data, latin1text, "The URL content is loaded properly");
    done();
  }, function(){
    assert.fail("should not reject");
    done();
  })

  assert.equal(content, "", "The URL content is not load yet");
}

exports["test sync readURI with ISO-8859-1 charset"] = function(assert) {
  let content = "";

  readURI(data.url("test-uri-io.txt"), { 
    sync: true, 
    charset: "ISO-8859-1"
  }).then(function(data) {
    content = data;
  }, function(){
    assert.fail("should not reject");
  })

  assert.equal(content, latin1text, "The URL content is loaded properly");
}

exports["test readURISync with ISO-8859-1 charset"] = function(assert) {

  let content = readURISync(data.url("test-uri-io.txt"), "ISO-8859-1");

  assert.equal(content, latin1text, "The URL content is loaded properly");
}

exports["test async readURI with not existing file"] = function(assert, done) {
  readURI(data.url("test-uri-io-fake.txt")).then(function(data) {
    assert.fail("should not resolve");
    done();
  }, function(reason){
    assert.ok(reason.indexOf("Failed to read:") === 0);
    done();
  })
}

exports["test sync readURI with not existing file"] = function(assert) {
  readURI(data.url("test-uri-io-fake.txt"), { sync: true }).then(function(data) {
    assert.fail("should not resolve");
  }, function(reason){
    assert.ok(reason.indexOf("Failed to read:") === 0);
  })
}

exports["test readURISync with not existing file"] = function(assert) {
  assert.throws(function(){
    readURISync(data.url("test-uri-io-fake.txt"));
  }, /NS_ERROR_FILE_NOT_FOUND/);
}

require("test").run(exports)
