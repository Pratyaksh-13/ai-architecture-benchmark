import http from 'k6/http';
import { check, sleep } from 'k6';

// BASE_URL is passed in via -e BASE_URL=http://localhost:8001 when running k6
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8001';

export const options = {
  vus: 10,           // virtual users — concurrent simulated clients
  duration: '20s',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
};

export default function () {
  // Create a short URL
  const shortenRes = http.post(
    `${BASE_URL}/shorten`,
    JSON.stringify({ url: `https://example.com/test/${__VU}/${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(shortenRes, {
    'shorten status is 201': (r) => r.status === 201,
  });

  if (shortenRes.status === 201) {
    const code = JSON.parse(shortenRes.body).code;

    // Immediately hit the redirect for that code — this is the high-traffic path
    const redirectRes = http.get(`${BASE_URL}/${code}`, { redirects: 0 });

    check(redirectRes, {
      'redirect status is 307': (r) => r.status === 307,
    });
  }

  sleep(1);  // light load — clients pause between requests
}
