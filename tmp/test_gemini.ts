
import { LLMService } from '../apps/api/src/services/llm.service';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../apps/api/.env') });

async function testGemini() {
  console.log('Testing Gemini with key:', process.env.GEMINI_API_KEY?.substring(0, 5) + '...');
  try {
    const result = await LLMService.generateFieldDescription('department', 'employees', 'string', 'Core');
    console.log('Result:', result);
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testGemini();
