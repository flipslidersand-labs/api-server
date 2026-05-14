import express from 'express';
import { metricsService } from '../services/metricsService.js';

const router = express.Router();

// Extended health check with detailed metrics
router.get('/health/detailed', (req, res) => {
  try {
    const health = metricsService.getHealth(true);
    res.json({
      success: true,
      data: health,
    });
  } catch (err) {
    const health = metricsService.getHealth(false);
    res.status(503).json({
      success: false,
      data: health,
      error: err.message,
    });
  }
});

// Real-time metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = metricsService.getMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Error statistics
router.get('/errors', (req, res) => {
  try {
    const period = req.query.period || '24h';
    const errorStats = metricsService.getErrorStats(period);

    res.json({
      success: true,
      data: errorStats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Simple HTML dashboard
router.get('/dashboard', (req, res) => {
  const metrics = metricsService.getMetrics();
  const errors = metricsService.getErrorStats('24h');

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>API Server Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: #0f172a;
          color: #e2e8f0;
          padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { margin-bottom: 30px; color: #60a5fa; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 20px;
        }
        .card h3 { color: #93c5fd; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
        .card .value { font-size: 32px; font-weight: bold; color: #60a5fa; }
        .card .unit { font-size: 12px; color: #64748b; }
        .status.healthy { color: #10b981; }
        .status.degraded { color: #f59e0b; }
        .status.unhealthy { color: #ef4444; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #60a5fa; font-weight: 600; }
        tr:hover { background: #334155; }
        .endpoint { color: #60a5fa; font-family: monospace; }
        .error { color: #ef4444; }
        .success { color: #10b981; }
        .chart { height: 200px; margin: 20px 0; }
        .timestamp { color: #64748b; font-size: 12px; margin-top: 10px; }
      </style>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <div class="container">
        <h1>🔧 API Server Monitoring Dashboard</h1>

        <div class="grid">
          <div class="card">
            <h3>Status</h3>
            <div class="value status ${metrics.requests.total > 0 ? 'healthy' : 'degraded'}">
              ${metrics.requests.total > 0 ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>

          <div class="card">
            <h3>Total Requests</h3>
            <div class="value">${metrics.requests.total}</div>
            <div class="unit">${metrics.uptime}s uptime</div>
          </div>

          <div class="card">
            <h3>Success Rate</h3>
            <div class="value success">${((metrics.requests.success / Math.max(metrics.requests.total, 1)) * 100).toFixed(1)}%</div>
            <div class="unit">${metrics.requests.errors} errors</div>
          </div>

          <div class="card">
            <h3>Avg Response Time</h3>
            <div class="value">${metrics.responseTime.avg}<span class="unit">ms</span></div>
            <div class="unit">P95: ${metrics.responseTime.p95}ms | P99: ${metrics.responseTime.p99}ms</div>
          </div>

          <div class="card">
            <h3>Memory Usage</h3>
            <div class="value">${metrics.memory?.heapUsed || 0}<span class="unit">MB</span></div>
            <div class="unit">Total: ${metrics.memory?.heapTotal || 0}MB</div>
          </div>

          <div class="card">
            <h3>Token Errors (24h)</h3>
            <div class="value ${metrics.tokenErrors > 5 ? 'error' : ''}">${metrics.tokenErrors}</div>
            <div class="unit">Auth failures</div>
          </div>
        </div>

        <h2 style="margin-top: 40px; margin-bottom: 20px; color: #60a5fa;">📊 Top Endpoints</h2>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Requests</th>
                <th>Errors</th>
                <th>Avg Time</th>
              </tr>
            </thead>
            <tbody>
              ${metrics.topEndpoints.map(ep => `
                <tr>
                  <td class="endpoint">${ep.endpoint}</td>
                  <td>${ep.requests}</td>
                  <td class="error">${ep.errors}</td>
                  <td>${ep.avgTime}ms</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h2 style="margin-top: 40px; margin-bottom: 20px; color: #60a5fa;">⚠️ Recent Errors (24h)</h2>
        <div class="card">
          <p><strong>Total Errors:</strong> ${errors.total}</p>
          <p><strong>By Type:</strong> ${Object.entries(errors.byType).map(([k, v]) => `${k}: ${v}`).join(' | ')}</p>
          ${errors.recent.length > 0 ? `
            <table style="margin-top: 15px;">
              <thead>
                <tr><th>Time</th><th>Status</th><th>Message</th><th>Endpoint</th></tr>
              </thead>
              <tbody>
                ${errors.recent.slice(0, 5).map(e => `
                  <tr>
                    <td>${new Date(e.timestamp).toLocaleTimeString('ja-JP')}</td>
                    <td class="error">${e.statusCode}</td>
                    <td>${e.message}</td>
                    <td class="endpoint">${e.endpoint}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p style="color: #64748b; margin-top: 10px;">✅ No errors in last 24 hours</p>'}
        </div>

        <div class="timestamp">Last updated: ${new Date().toISOString()}</div>
      </div>
    </body>
    </html>
  `;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
