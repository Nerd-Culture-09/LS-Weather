/*
 * Helpers for faking my.request.
 */

// Answer every request immediately: reply(options) returns the response data,
// or an object { fail: error } to make the request fail.
function respondWith(reply) {
  my.request.mockImplementation((options) => {
    const result = reply(options);
    if (result && result.fail) {
      options.fail(result.fail);
    } else {
      options.success({ status: 200, data: result });
    }
  });
}

// Hold every request until the test answers it, to control ordering
function holdRequests() {
  const held = [];
  my.request.mockImplementation((options) => {
    held.push({
      url: options.url,
      options,
      reply(data) {
        options.success({ status: 200, data });
      },
      fail(error) {
        options.fail(error);
      },
    });
  });
  return held;
}

module.exports = { respondWith, holdRequests };
