const path = require('path');
const fs = require('fs');

const exportService = require('../services/exportService');
const { submitExportJob } = require('../queues/submit');

const userId = 1;

async function listByProject(req, res) {
  try {
    const rows = await exportService.listExportsByProject(req.params.project_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function create(req, res) {
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
        config,
      },
      userId
    );

    res.json({ success: true, message: '导出任务已提交', data: { export_id: exportId, job_id: jobId } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function exportVideo(req, res) {
  try {
    const { project_id, quality, format } = req.body;
    const { jobId, exportId } = await submitExportJob(project_id, { format: format || 'mp4', quality: quality || '1080p' }, userId);
    res.json({ success: true, message: '开始导出视频', data: { export_id: exportId, job_id: jobId } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function exportPdf(req, res) {
  try {
    const { project_id } = req.body;
    const { jobId, exportId } = await submitExportJob(project_id, { format: 'pdf' }, userId);
    res.json({ success: true, message: '开始导出PDF', data: { export_id: exportId, job_id: jobId } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function status(req, res) {
  try {
    const row = await exportService.getExportStatus(req.params.export_id);
    if (!row) return res.status(404).json({ success: false, message: '导出记录不存在' });
    const downloadUrl = row.status === 'completed' ? `/api/exports/${row.id}/download` : null;
    res.json({ success: true, data: { ...row, download_url: downloadUrl } });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

async function download(req, res) {
  try {
    const exportId = req.params.export_id;
    const row = await exportService.getExportDownloadInfo(exportId);
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
}

async function remove(req, res) {
  try {
    await exportService.deleteExport(req.params.export_id);
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    console.error('[Exports] 操作失败:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listByProject,
  create,
  exportVideo,
  exportPdf,
  status,
  download,
  remove,
};
