import axios from 'axios';

const headers = {
    'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9,zh;q=0.8,zh-HK;q=0.7,zh-CN;q=0.6,zh-TW;q=0.5',
        'connection': 'keep-alive',
        'dnt': '1',
        'origin': 'https://app.mmt.finance',
        'referer': 'https://app.mmt.finance/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="135", "Not-A.Brand";v="8"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"'
}

export const getLeaderboardInfo = async (address) => {
    try {
        const response = await axios.get(
            `https://api.mmt.finance/leaderboard?address=${address}&liquidity=20`,
            { headers }
        );

        if (response.status === 200 && response.data.status === 200) {
            return response.data.data;
        }
        return null;
    } catch (error) {
        console.error('获取leaderboard失败:', error);
        return null;
    }
};