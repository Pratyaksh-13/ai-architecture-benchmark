// k6/resilience/pre_failure.js  
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8001';

export const options = {
  vus: 20,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
};

export default function () {
  const shortenRes = http.post(
    `${BASE_URL}/shorten`,
    JSON.stringify({ url: `https://example.com/resilience/${__VU}/${__ITER}` }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(shortenRes, { 'shorten ok': (r) => r.status === 201 });

  if (shortenRes.status === 201) {
    const code = JSON.parse(shortenRes.body).code;
    const redirectRes = http.get(`${BASE_URL}/${code}`, { redirects: 0 });
    check(redirectRes, { 'redirect ok': (r) => r.status === 307 });
  }

  sleep(0.5);
}