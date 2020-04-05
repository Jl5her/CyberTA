const ACK = '👍';
const NAK = '🛑';

const moment = require('moment');

let x = 0;
let taOn = 0;
const queue = [];
const dequeued = [];

const { OFFICE_HOURS, TA_CHANNEL } = process.env;

const tas = {
  '411720574528913418': {
    name: 'Brad',
    last_helped_id: null,
    last_helped_time: 0,
  },
  '117015211952570374': {
    name: 'Jack',
    last_helped_id: null,
    last_helped_time: 0,
  },
  '97501254363664384': {
    name: 'Avery',
    last_helped_id: null,
    last_helped_time: 0,
  },
  '375835699037077515': {
    name: 'Patrick',
    last_helped_id: null,
    last_helped_time: 0,
  },
};

function ready(message, readyIndex) {
  /**
     * If the next person in the queue is offline, it should skip over them.
     * This will be a permenant skip, and will not add it to the dequeue cache.
     */

  if (readyIndex >= queue.length) return;

  const msg = queue[readyIndex].message;
  msg.reply(`${tas[message.author.id].name} is ready for you. Move to TA office.`);
  msg.delete();

  // Tells you time spent and people on queue.
  if (tas[message.author.id].last_helped_time !== 0) {
    const startTime = tas[message.author.id].last_helped_time;
    const endTime = new Date();
    let timeDiff = endTime - startTime; // in ms
    timeDiff /= 1000;
    const timespent = Math.round(timeDiff) / 60;
    message.reply(`You have spent ${timespent} minutes with that team. ${queue.length - 1} people on the queue.`);
  } else {
    message.reply(`Readying up. There are ${queue.length - 1} people left on the queue.`);
  }

  dequeued.push(queue[readyIndex]);
  queue.splice(readyIndex, 1);
  tas[message.author.id].last_helped_time = new Date();

  message.react(ACK);
}

function index(member) {
  for (let i = 0; i < queue.length; i += 1) {
    if (queue[i].member.id === member.id) {
      return i;
    }
  }
  return -1;
}

function contains(member) {
  return index(member) !== -1;
}

/**
 * Users can add themselves to the queue via the next command. If users are
 * already on the queue, it will let them know and quit. The bot will also
 * let them know on success
 */

exports.onNext = (message, args) => {
  if (message.channel.id !== OFFICE_HOURS) return;

  if (taOn === 0) {
    message.reply("Sorry there are no TA's on.");
    return;
  }

  if (contains(message.author)) {
    message.react(NAK);
    message.reply('You are already on the queue.')
      .then((msg) => {
        msg.delete({ timeout: 5000 });
        message.delete({ timeout: 5000 });
      });
    return;
  }

  queue.push({
    member: message.author,
    desc: args.join(' '),
    message,
    timestamp: new Date(),
  });

  message.react(ACK);

  message.reply(`You are now #${queue.length} in the queue.`)
    .then((msg) => {
      msg.delete({ timeout: 10 * 1000 });
    });
};

/**
 * If a TA accidently readied a student, and needs to put them back on the queue.
 * '!undo' will automatically put the last dequeued member back to the front of the queue.
 *
 * If the bot does not remember any recent readied students, it will tell the TA.
 *
 * There is currently no Bot process for letting the user know it was an accident
 */

exports.onUndo = (message) => {
  if (TA_CHANNEL === message.channel.id) {
    if (dequeued.length === 0) {
      message.react(NAK);
      message.reply('```nimrod\nThere is currently nothing in the dequeue cache.```');
      return;
    }
    queue.splice(0, 1, dequeued.pop());
    message.react(ACK);
    message.reply("```nimrod\nDone! Don't screw up next time!```");
  }
};

exports.onQueue = (message) => {
  if (TA_CHANNEL === message.channel.id) {
    if (queue.length === 0) {
      message.channel.send('```nimrod\nThe queue is currently empty```');
      return;
    }
    let body = '';
    for (let i = 0; i < queue.length; i += 1) {
      const { username } = queue[i].member;
      const waitTime = moment(queue[i].timestamp).fromNow();
      const { desc } = queue[i];

      body += `${i}) ${username} "${desc}"\t\t [${waitTime}]\n`;
    }
    message.channel.send(`\`\`\`nimrod\n\${${body}\`\`\``);
  }
};

// This potentially could be where the TA-leave functionality goes
exports.onLeave = (message) => {
  if (OFFICE_HOURS === message.channel.id) {
    if (!contains(message.author)) {
      message.react(NAK);
      message.delete({ timeout: 10 * 1000 });
      return;
    }

    queue.splice(index(message.author), 1);
    message.react(ACK);
    message.delete({ timeout: 10 * 1000 });
  }
};

exports.onRemove = (message, args) => {
  if (TA_CHANNEL !== message.channel.id) return;

  if (args.length === 0 || Number.isNaN(args[0])) {
    message.reply('Please provide an index to remove.');
    message.reply('`!remove <index>`');
    return;
  }

  const removeIndex = parseInt(args[0], 10);
  if (removeIndex >= queue.length) {
    message.react(NAK);
    message.reply('Invalid index.');
    return;
  }

  message.react(ACK);
  queue.splice(removeIndex, 1);
};

exports.onReady = (message, args) => {
  // If you are not online, you can't ready up.
  if (TA_CHANNEL !== message.channel.id) return;
  if (tas[message.author.id].online_status === 0) {
    message.reply("You are offline. Can't ready up.");
    return;
  }
  if (queue.length === 0) {
    message.channel.send('```nimrod\nThe queue is currently empty```');
    return;
  }

  let readyIndex = 0;
  if (args.length > 0 && !Number.isNaN(args[0])) {
    readyIndex = parseInt(args[0], 10);
  }

  if (readyIndex >= queue.length) {
    message.react(NAK);
    message.reply('Invalid index.');
    return;
  }

  ready(message, readyIndex);
};

exports.onOof = (message) => {
  x += 1;
  message.reply(`There has been ${x} 'persistent' questions to date.`);
};

// Sets TA to online
exports.onOnline = (message, args, client) => {
  if (TA_CHANNEL === message.channel.id) {
    if (tas[message.author.id].online_status === 1) {
      message.reply('You are already online.');
      return;
    }

    tas[message.author.id].online_status = 1;
    taOn += 1;
    client.channels.cache.get(process.env.OFFICE_HOURS).send(`${message.author.toString()} is now online. Ready to answer questions!:wave:`);
    message.reply('You are now online.');
  }
};
// Sets TA to Offline
exports.onOffline = (message, args, client) => {
  if (TA_CHANNEL === message.channel.id) {
    if (tas[message.author.id].online_status === 0) {
      message.reply('You are already offline.');
      return;
    }

    tas[message.author.id].online_status = 0;
    taOn -= 1;
    client.channels.cache.get(process.env.OFFICE_HOURS).send(`${message.author.toString()} is now offline.:x:`);
    message.reply('You are now offline. ');
  }
};

exports.onHelp = (message) => {
  if (TA_CHANNEL === message.channel.id) {
    message.reply('```'
            + 'ping - simple test that responds with "pong".\n'
            + "!queue - view the queue w/ username, issue description, and how long they've been waiting.\n"
            + '!undo - quickly undo the ready command that removed them from the queue.\n'
            + '!remove <index> - removes user from queue at certain index. Does not alert the user.\n'
            + "!ready [index] - removes user from queue at index (top if index isn't provided). Alerts the user that the TA is ready.\n"
            + '!help - shows these commands.```');
    return;
  }
  message.reply('```'
        + "next [issue] - adds a user to queue and responds with user's position in queue. Please provide an issue.\n"
        + '\nhelp - provides a list of commands and their functions.```');
};
