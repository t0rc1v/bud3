## roles
- admin, teacher, student

## admin
1. create grades
2. create grade subjects
3. create topics
4. upload material to topic - notes/yt/audio?/image
- provide description of uploaded material for AI 
- if resource is added to chat, the following is provided to the AI:
    - resource schema: title, description, url, type(will determine rendering)
    - rendering done for the 4 types of resources
5. AI chat

## teacher
1. view grades
2. view grade subjects
3. view subject topics
4. view topic resources
5. add `my_learners`: require email
6. AI chat
- AI tools: web_search(powered by exa ai), memory
- AI artifacts: quiz

### my_learners
- when a teacher creates a `my_learners` list which will enable them to easily monitor and reference details about their learners. for example weak areas

## student
- same as teacher without add `my_learners`


---

## AI
- AI chat powered by ai-sdk
- context from resources can be added to chat
- AI has tool for web and youtube search powered by exa ai and memory(saved in the database)
- Memory tool can save structured data. for example, a teacher can upload a file with subject results which they would like to save for future reference of their learners
- reasearch tool which can be used to research for materials to use within a topic from the web or youtube
- when a resource is added to chat from the database, the AI will be provided with the url which is saved in the database and read the contents of the resource provided by accessing the url. for example a pdf or image url
- tools for calling db functions. for example a teacher can message AI to create a notification for their learners

---

