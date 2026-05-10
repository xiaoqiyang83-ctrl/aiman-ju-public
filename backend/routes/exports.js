const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { pool } = require('../shared');
const { submitExportJob } = require('../queues/submit');

const userId = 1;

router.get('/project/:project_id/list', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM exports WHERE project_id = $1 ORDER BY created_at DESC',
      [req.params.project_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { project_id, config, resolution, quality, format, include_voice, include_bgm } = req.body || {};
    if (!project_id) {
      return res.status(400).json({ success: false, message: '缺少 project_id' });
    }

    const { jobId, exportId } = await submitExportJob(
      project_id,
      {
        format: format || config?.format || 'mp4',
        resolution: resolution || quality || config?.resolution || config?.quality || '1080p',
        include_voice: include_voice ?? config?.include_voice,
        include_bgm: include_bgm ?? config?.include_bgm,
        config
      },
      userId
    );

    res.json({
      success: true,
      message: '导出任务已提交',
      data: { export_id: exportId, job_id: jobId }
    });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/video', async (req, res) => {
  try {
    const { project_id, quality, format } = req.body;
    const { jobId, exportId } = await submitExportJob(
      project_id,
      { format: format || 'mp4', quality: quality || '1080p' },
      userId
    );
    res.json({ success: true, message: '开始导出视频', data: { export_id: exportId, job_id: jobId } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/pdf', async (req, res) => {
  try {
    const { project_id } = req.body;
    const { jobId, exportId } = await submitExportJob(project_id, { format: 'pdf' }, userId);
    res.json({ success: true, message: '开始导出PDF', data: { export_id: exportId, job_id: jobId } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:export_id/status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, project_id, format, status, progress, error_message, file_url, file_path, config, created_at, updated_at FROM exports WHERE id = $1',
      [req.params.export_id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ success: false, message: '导出记录不存在' });

    const downloadUrl = row.status === 'completed' ? `/api/exports/${row.id}/download` : null;
    res.json({ success: true, data: { ...row, download_url: downloadUrl } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:export_id/download', async (req, res) => {
  try {
    const exportId = req.params.export_id;
    const result = await pool.query(
      'SELECT id, status, file_path, file_url, format FROM exports WHERE id = $1',
      [exportId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ success: false, message: '导出记录不存在' });
    if (row.status !== 'completed') {
      return res.status(400).json({ success: false, message: '导出尚未完成' });
    }

    const publicPath = row.file_path || row.file_url;
    if (!publicPath) {
      return res.status(404).json({ success: false, message: '导出文件不存在' });
    }

    const filename = path.basename(publicPath);
    const absPath = path.join(__dirname, '..', 'uploads', 'exports', filename);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, message: '导出文件不存在' });
    }
    res.download(absPath, filename);
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:export_id', async (req, res) => {
  try {
    await pool.query('DELETE FROM exports WHERE id = $1', [req.params.export_id]);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
