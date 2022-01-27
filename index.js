const { Client } = require('@notionhq/client')
const notion = new Client({ auth: process.env.NOTION_KEY })
const AWS = require('aws-sdk');

const dbByTitleFilter = (str) => ({ title: [{plain_text}] }) => plain_text === str
const getTasksQueryObj = (dbId) => ({
    database_id: dbId,
    filter: {
        or: [
            {
                property: "Is shared",
                formula: {
                    checkbox: {
                        equals: true
                    }
                }
            }
        ]
    }
})
const dbsSearchObj = { 
    query: '', 
    filter: {
        property: 'object',
        value: 'database'
    }
}

const toClonedTaskDecorator = (database_id) => async (task) => {
    const props = [
        "Status",
        "Due",
        "Tags",
        "Project",
        "Theme",
        "Assignee",
    ].reduce((prev, key) => {
        const matchedProp = task.properties[key]
        const type = matchedProp?.type
        return matchedProp 
            ? { ...prev, [key]: {[type]: matchedProp[type]} }
            : prev
    }, {
        title: { 
            title: [
                {
                    "text": {
                        "content": task.properties.Name.title[0].plain_text
                    }
                }
            ]
        }           
    })

    await notion.pages.create({
        parent: { database_id },
        properties: props      
    })
}

exports.handler = async (event, context, callback) => {
    const dbsSearch = await notion.search(dbsSearchObj)
    const dbs = dbsSearch.results
    const dbsMap = {
        tasks: {
            main: dbs.find(dbByTitleFilter("Tasks")).id,
            shared: dbs.find(dbByTitleFilter("Tasks (shared)")).id
        },
        projects: {
            main: dbs.find(dbByTitleFilter("Projects")).id
        },
        rules: {
            main: dbs.find(dbByTitleFilter("Rules")).id
        }
    }

    const tasksQueryObj = getTasksQueryObj(dbsMap.tasks.main)
    const tasksQuery = await notion.databases.query(tasksQueryObj)
    const tasks = tasksQuery.results
    const clonedTasks = await Promise.all(tasks.map(toClonedTaskDecorator(dbsMap.tasks.shared)))
    const success = `Successfully cloned ${clonedTasks.length} tasks`

    console.log(success)
    return success
}