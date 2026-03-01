# 特定技能2号 Application

A React-based quiz application for Japanese construction terminology, featuring automatic Furigana support, an admin dashboard, and quarterly update capabilities.

## 🚀 How to Make Public (Deploy)

To let public users use this app, you need to turn the code into a website.

### Step 1: Build the Project
1. Open your terminal/command prompt in this folder.
2. Run `npm install` to install the necessary tools.
3. Run `npm run build`.
   - This will create a new folder called **`dist`**.
   - The `dist` folder contains everything your app needs to run.

### Step 2: Publish Online
You can host the `dist` folder for free on many services.

**Method A: Netlify (Easiest)**
1. Go to [Netlify Drop](https://app.netlify.com/drop).
2. Drag and drop the **`dist`** folder you just created into the browser window.
3. Your site is now online! You can share the link.

**Method B: Vercel**
1. Install Vercel: `npm i -g vercel`
2. Run `vercel` in this directory and follow the prompts.

---

## 🔄 Quarterly Updates (How to add questions)

You can update the questions without coding:

1. **Login to Admin**: Open your deployed app, click "Admin" at the bottom, and enter PIN `1234`.
2. **Manage Questions**:
   - **Upload Word Doc**: Upload a `.docx` file with questions (Format: `1. Question... A. Option...`).
   - **Manual Add**: Use the form to add individual questions, photos, or textbook page references.
   - **Delete**: Remove old questions from the list.
3. **Export**: Click the **"Export Data"** button in the top right.
   - This downloads a file named `questions.ts`.
4. **Update Code**:
   - Take the downloaded `questions.ts` file.
   - Replace the `questions.ts` file in your source code folder with this new one.
5. **Re-deploy**: Run `npm run build` again and upload the new `dist` folder.

## 📂 Project Structure

- **src/App.tsx**: Main application logic (Menu, Exam, Admin).
- **src/questions.ts**: The database of questions.
- **src/components/**: UI components like QuizCard.
- **index.html**: Entry point.

## 🛠 Development

To run the app on your own computer while editing:

```bash
npm run dev
```
