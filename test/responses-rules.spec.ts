import { Tests } from './lib/tests';
import { HttpCall } from './lib/types';

const tests = new Tests('responses-rules');

describe('Responses rules', () => {
  tests.runHooks();

  it('Start default environment', async () => {
    await tests.helpers.startEnvironment();
  });

  describe('Create, update, delete and test basic rules', async () => {
    it('Add a route response with status 200', async () => {
      await tests.helpers.selectRoute(1);
      await tests.helpers.countRouteResponses(1);
      await tests.helpers.addRouteResponse();
      await tests.helpers.countRouteResponses(2);
    });

    it('Route with multiple responses and no rules defined should return the first response', async () => {
      await tests.helpers.httpCallAsserter({
        path: '/users/1',
        method: 'GET',
        testedResponse: {
          status: 500
        }
      });
    });

    it('Add a url params rule to response 200, if fulfilled should return 200', async () => {
      await tests.helpers.selectRouteResponse(2);
      await tests.helpers.switchTab('RULES');
      await tests.helpers.addResponseRule({
        modifier: 'userid',
        target: 'params',
        value: '10',
        isRegex: false
      });
      await tests.helpers.httpCallAsserter({
        path: '/users/10',
        method: 'GET',
        testedResponse: {
          status: 200
        }
      });
    });

    it('Add a query string rule to response 500, both routes rules can be fulfilled but returns 500', async () => {
      await tests.helpers.selectRouteResponse(1);
      await tests.helpers.switchTab('RULES');
      await tests.helpers.addResponseRule({
        modifier: 'userid',
        target: 'query',
        value: '5',
        isRegex: false
      });
      await tests.helpers.httpCallAsserter({
        path: '/users/10?userid=5',
        method: 'GET',
        testedResponse: {
          status: 500
        }
      });
    });

    it('Add a header rule to response 500, test rule', async () => {
      await tests.helpers.switchTab('RULES');
      await tests.helpers.addResponseRule({
        modifier: 'Accept',
        target: 'header',
        value: 'application/xhtml+xml',
        isRegex: false
      });
      await tests.helpers.httpCallAsserter({
        path: '/users/1234',
        headers: { Accept: 'application/xhtml+xml' },
        method: 'GET',
        testedResponse: {
          status: 500
        }
      });
    });

    it('Delete a route response', async () => {
      await tests.helpers.countRouteResponses(2);
      await tests.helpers.removeRouteResponse();
      await tests.helpers.countRouteResponses(1);
    });
  });

  describe('Test advanced rules', async () => {
    const testCases: HttpCall[] = [
      {
        description: 'Query string object with regex',
        path: '/rules/query?obj[prop1]=value1&obj[prop2]=value2',
        method: 'GET',
        testedResponse: {
          status: 200,
          body: '1'
        }
      },
      {
        description: 'Query string array with regex',
        path: '/rules/query?array[]=test1&array[]=test2',
        method: 'GET',
        testedResponse: {
          status: 200,
          body: '2'
        }
      },
      {
        description: 'Route param with regex',
        path: '/rules/100',
        method: 'GET',
        testedResponse: {
          status: 200,
          body: '3'
        }
      },
      {
        description: 'Header Accept-Charset without regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Accept-Charset': 'UTF-8'
        },
        testedResponse: {
          status: 200,
          body: '4'
        }
      },
      {
        description: 'Header Accept-Charset with regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Accept-Charset': 'UTF-16'
        },
        testedResponse: {
          status: 200,
          body: '5'
        }
      },
      {
        description: 'Body property without regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { name: 'john' },
        testedResponse: {
          status: 200,
          body: '6'
        }
      },
      {
        description: 'Body path to property without regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { user: [{ name: 'John' }] },
        testedResponse: {
          status: 200,
          body: '7'
        }
      },
      {
        description: 'Body path to array without regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { users: ['John', 'Johnny', 'Paul'] },
        testedResponse: {
          status: 200,
          body: '8'
        }
      },
      {
        description: 'Body property with regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { user: 'Richard' },
        testedResponse: {
          status: 200,
          body: '9'
        }
      },
      {
        description: 'Body path to non existing property with regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {},
        testedResponse: {
          status: 404,
          body: '0'
        }
      },
      {
        description: 'Body path to array with regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { users: ['Bob', 'Rick', 'Richard'] },
        testedResponse: {
          status: 200,
          body: '10'
        }
      },
      {
        description: 'Body path when Content-Type contains more info (charset)',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json;charset=UTF-8'
        },
        body: { test: 'test' },
        testedResponse: {
          status: 200,
          body: '11'
        }
      },
      {
        description: 'Body path to number, with regex',
        path: '/rules/2',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { test: 1 },
        testedResponse: {
          status: 200,
          body: '12'
        }
      }
    ];

    for (let index = 0; index < testCases.length; index++) {
      it(testCases[index].description, async () => {
        await tests.helpers.httpCallAsserter(testCases[index]);
      });
    }
  });
});
