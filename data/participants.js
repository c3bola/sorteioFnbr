const fs = require('fs');
const participantsFile = './data/json/participants.json';

function loadParticipants() {
  try {
    if (fs.existsSync(participantsFile)) {
      const data = fs.readFileSync(participantsFile);
      return JSON.parse(data);
    }
    return { groups: {} };
  } catch (error) {
    console.error('Error loading participants:', error);
    return { groups: {} };
  }
}

function saveParticipants(participants) {
  try {
    fs.writeFileSync(participantsFile, JSON.stringify(participants, null, 2));
  } catch (error) {
    console.error('Error saving participants:', error);
  }
}

function loadRaffleParticipants(groupId, raffleId) {
  try {
    const data = loadParticipants();
    if (!data.groups) {
      data.groups = {};
    }
    const group = data.groups[groupId] || { raffles: [], previousWinners: [] };
    const raffle = group.raffles.find(r => r.id === raffleId) || { participants: [] };
    return raffle.participants;
  } catch (error) {
    console.error('Error loading raffle participants:', error);
    return [];
  }
}

function saveRaffleParticipants(groupId, groupName, raffleId, participants) {
  try {
    const data = loadParticipants();
    if (!data.groups) {
      data.groups = {};
    }
    if (!data.groups[groupId]) {
      data.groups[groupId] = { name: groupName, raffles: [], previousWinners: [] };
    }
    const group = data.groups[groupId];
    let raffle = group.raffles.find(r => r.id === raffleId);
    if (!raffle) {
      raffle = { id: raffleId, participants: [], numWinners: 0 };
      group.raffles.push(raffle);
    }
    raffle.participants = participants;
    raffle.participantCount = participants.length; // Update participant count
    saveParticipants(data);
  } catch (error) {
    console.error('Error saving raffle participants:', error);
  }
}

function saveRaffleNumWinners(groupId, raffleId, numWinners) {
  try {
    const data = loadParticipants();
    if (!data.groups) {
      data.groups = {};
    }
    const group = data.groups[groupId] || { raffles: [], previousWinners: [] };
    let raffle = group.raffles.find(r => r.id === raffleId);
    if (!raffle) {
      raffle = { id: raffleId, participants: [], numWinners: 0 };
      group.raffles.push(raffle);
    }
    raffle.numWinners = numWinners;
    saveParticipants(data);
  } catch (error) {
    console.error('Error saving raffle number of winners:', error);
  }
}

function getPreviousWinners(groupId) {
  try {
    const data = loadParticipants();
    const group = data.groups[groupId] || { previousWinners: [] };
    return group.previousWinners;
  } catch (error) {
    console.error('Error getting previous winners:', error);
    return [];
  }
}

function addPreviousWinners(groupId, winners) {
  try {
    const data = loadParticipants();
    if (!data.groups[groupId]) {
      data.groups[groupId] = { raffles: [], previousWinners: [] };
    }
    const group = data.groups[groupId];
    group.previousWinners.push(...winners.map(w => w.id));
    saveParticipants(data);
  } catch (error) {
    console.error('Error adding previous winners:', error);
  }
}

function resetPreviousWinners(groupId) {
  try {
    const data = loadParticipants();
    if (data.groups[groupId]) {
      data.groups[groupId].previousWinners = [];
      saveParticipants(data);
    }
  } catch (error) {
    console.error('Error resetting previous winners:', error);
  }
}

function getRaffleParticipantCount(groupId, raffleId) {
  try {
    const participants = loadRaffleParticipants(groupId, raffleId);
    return participants.length;
  } catch (error) {
    console.error('Error getting raffle participant count:', error);
    return 0;
  }
}

module.exports = {
  loadParticipants,
  saveParticipants,
  loadRaffleParticipants,
  saveRaffleParticipants,
  saveRaffleNumWinners,
  getPreviousWinners,
  addPreviousWinners,
  resetPreviousWinners,
  getRaffleParticipantCount
};
