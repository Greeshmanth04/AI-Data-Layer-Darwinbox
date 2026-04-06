import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY;
console.log('API Key present:', !!apiKey);
if (apiKey) {
    console.log('Key length:', apiKey.length);
    console.log('Key prefix:', apiKey.substring(0, 7));
}

async function testGemini() {
    if (!apiKey) {
        console.error('No API key found in .env');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);

        console.log(`Testing model: gemini-2.5-flash...`);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent('Say ping');
        console.log(`Success with gemini-2.5-flash! Response:`, result.response.text());
    } catch (err: any) {
        console.error('Gemini diagnostic failed:');
        console.error(err.message);
    }
}

testGemini();
