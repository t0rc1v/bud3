## account creation

### super-admin
sign up as regular/admin then edit public metadata in clerk with 
    {
        role: "super_admin"
    }
webhook updates user table with super-admin role

### /onboarding
- sign up as regular/admin

---

## layout

### sidebar
- content tree

### content
- CRUD levels, subjects, topics, resources(pdfs, yt, images, audio)
- content tree

### ai chat
- tools: web(Exa), memory, server actions
- add resources for context
    - url of resource passed

--- 

## super-admin
- dashboard
    - 3 tabs(super/public, admin, regular)
    - CRUD buttons(owned content)
    - edit/delete all content
- manage admins
- gift credits
    - including own
    - not from credit pool
- gift content unlocks
    - unlock resource for user
- manage unlock fees
    -manage fees set for resources


## admin
- dashboard
    - 2 tabs(super/public, admin)
    - CRUD buttons(owned content)
    - edit/delete owned content
- manage regulars
    - bulk or single
    - added regulars can access content created by their admin
- gift credits
    - not including own
    - from credit pool
- gift content unlocks
    - unlock resource for user
- manage unlock fees
    - manage fees set for resources
- unlock content from super-admin
    - using credits or mpesa
- buy credits
    - mpesa


## regular
- dashboard
    - 3 tabs(super/public, admin, regular)
    - CRUD buttons(owned content)
    - edit/delete owned content
- gifted content unlocks
    - unlocked resource for by admin/super
- buy credits
    - including own
    - not from credit pool
- unlock resource
    - credits or mpesa

--- 

## specs

### packages
- react-pdf: pdf-viewer
- exa ai


---
---


## BUD4 (education/institution based)

automate basic learner, teacher and admin roles
same bud3 layout

**learner**
consumes:
    - notes
    - assignments
    - exams
revision
exploration

**teacher**
creates: 
    - notes
    - assignments
    - exams
progress tracking
research/exploration

**admin**
overview of everything

---

### application

**notes**
uploads
categories: pdfs, yt, images, audio
add to chat

**revision**
AI generated:
- summary
- overview
- references
- keywords
- practice qns: done in app or done externally for tr to mark(where there maybe limitations like math)
- flashcards

**assignments**
topic based. export to pdf

**exams**
topics/subject based. broader than assignment. export to pdf

**progress tracking**
- give me analysis of student x

**research and exploration**
web tool

**overview**
- give me analysis of student x
- give me analysis of topic y
- give me analysis of subject z performance

#### data
scores: for progress and analysis tracking


### AI

**tools**
- web: for research
- memory:
- assignments/practice qns: 
    - prompt will more topic based, not broad. 
    - max 10 questions
    - with artifact and pdf export 
- exam/quiz: 
    - from admin dash. access to list of regulars and levels. if level not provided, ai provides all choices
    - prompt will be topics/subject based, very broad. 
    - max 30 questions
    - title required 
    - only pdf export
    - scoresheet excel export. title, list of admin's learners, score
- analysis


### roles
*super-admin*: institution
- manage admins: promote/revoke
- manage regulars: add/remove regulars to the institution
- access to all data
- gift credits and unlocks
- manage unlock fees for their content 
- CRUD content: all access
- content accessible by all under hierarchy. locked/free

*admin*: teacher
- manage regulars: add/remove regulars to have access to their content
- access to own and super content
- gift credits and unlocks: from their pool
- manage unlock fees for their content 
- CRUD content: own content
- content accessible by all under hierarchy. locked/free

*regular*: learner
- access to own, super, and their admin content
- manage unlock fees for their content 
- share content
- CRUD content: own content
- content accessible if made public


### flow
- onboarding: 
    - super: name, category
    - regular: name, education level(pre-defined, not required)
- regular to admin status given by super


