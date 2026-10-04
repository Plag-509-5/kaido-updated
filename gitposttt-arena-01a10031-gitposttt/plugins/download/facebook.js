const axios = require('axios');

async function downloadFacebook(url) {
  try {
    const res = await axios.get(`https://api.giftedtech.web.id/api/download/facebook?apikey=gifted&url=${encodeURIComponent(url)}`, { timeout: 20000 });
    if (res.data?.result) {
      const d = res.data.result;
      return {
        title: d.title || 'Facebook Video',
        videoUrl: d.hd || d.sd || d.video
      };
    }
  } catch (e) {}

  throw new Error('Impossible de télécharger la vidéo Facebook. Lien invalide ou privé.');
}

module.exports = {
  name: 'facebook',
  alias: ['fb', 'fbdl', 'fbvideo'],
  category: 'download',
  description: 'Télécharge une vidéo depuis Facebook',
  usage: '.fb <lien Facebook>',
  async execute({ socket, msg, from, args, prefix }) {
    const url = args[0];
    if (!url || (!url.includes('facebook.com') && !url.includes('fb.watch'))) {
      return await socket.sendMessage(from, {
        text: `👥 *Usage :* \`${prefix}fb https://fb.watch/...\``
      }, { quoted: msg });
    }

    await socket.sendMessage(from, { text: '⏳ *Téléchargement de la vidéo Facebook...*' }, { quoted: msg });

    try {
      const data = await downloadFacebook(url);
      await socket.sendMessage(from, {
        video: { url: data.videoUrl },
        caption: `👥 *Facebook Video* — 𝐊𝐚𝐢𝐝𝐨-𝐌𝐃\n📌 ${data.title}`
      }, { quoted: msg });
    } catch (err) {
      console.error('[FB ERROR]', err);
      await socket.sendMessage(from, { text: `❌ ${err.message}` }, { quoted: msg });
    }
  }
};
