const URL_EVENTS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=0&single=true&output=csv";
const URL_STANDS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=605861319&single=true&output=csv";
const URL_LOCATIONS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=127409386&single=true&output=csv";
const URL_DETAILS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=2086466838&single=true&output=csv";    
const URL_PARAMS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=218585894&single=true&output=csv";    
const URL_NEWS = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSVpMD0v95h405KGnE8GNU1-gq0yBVhrUvVAFQly-0nK8W8Mhj7RnKFdf5LVPaBV8MOxjbGnRMSIe1B/pub?gid=2012752905&single=true&output=csv";

let dbEvents = [];
let dbStands = [];
let dbLocations = {}; 
let dbDetails = {};
let dbParams = [];
let dbNews = [];
let selectedDayString = ""; 
let scheduleRefreshTimer = null;
    
function fetchAndParseCsv(url) {
    return new Promise((resolve, reject) => {
        Papa.parse(url, {
            download: true,       
            header: true,         
            skipEmptyLines: true,  
            complete: (results) => resolve(results.data),
            error: (error) => reject(error)
        });
    });
}

async function initDatabaseApp() {
    try {
        const [rawLocations, rawDetails, rawEvents, rawStands, rawParams, rawNews] = await Promise.all([
            fetchAndParseCsv(URL_LOCATIONS),
            fetchAndParseCsv(URL_DETAILS),
            fetchAndParseCsv(URL_EVENTS),
            fetchAndParseCsv(URL_STANDS),
            fetchAndParseCsv(URL_PARAMS),
            fetchAndParseCsv(URL_NEWS)
        ]);

        // Load paramters from database
        const params = {};
        rawParams.forEach(row => {
            if (row.Param_Key) {
                params[row.Param_Key.trim()] = row.Param_Value ? row.Param_Value.trim() : "";
            }
        });

        // 2. Extracted Start Date Logic (Cleaned up using the new map)
        if (params["Festival_Start_Date"]) {
            // Set our global tracking state to the spreadsheet value
            selectedDayString = params["Festival_Start_Date"];
    
            // Calculate Day 2 by parsing Day 1 and adding 24 hours
            const day1Date = new Date(selectedDayString + "T00:00:00");
            const day2Date = new Date(day1Date);
            day2Date.setDate(day1Date.getDate() + 1);
    
            const day2String = day2Date.toISOString().split('T')[0];

            // Dynamically update the onclick behaviors of your Friday/Saturday DOM buttons
            const btnDay1 = document.getElementById('btn-day1');
            const btnDay2 = document.getElementById('btn-day2');
    
            if (btnDay1) btnDay1.setAttribute('onclick', `switchDay('${selectedDayString}', event)`);
            if (btnDay2) btnDay2.setAttribute('onclick', `switchDay('${day2String}', event)`);
        } else {
            // Fallback safety setting if the key is missing or misconfigured
            selectedDayString = "2026-07-10"; 
        }

        // Update DOM from parameters
        if (params["App_Title"]) {
            document.querySelector("#header h1").innerText = params["App_Title"];
            document.title = params["App_Title"];
        }
        if (params["Welcome_Hero"]) {
            document.querySelector("#home-screen .hero-text").innerText = params["Welcome_Hero"];
        }
        if (params["Default_Map_URL"]) {
            const mainMapIframe = document.getElementById("default-map");
            if (mainMapIframe) {
                mainMapIframe.src = params["Default_Map_URL"];
            }
        }

        // Get cache refresh rate from parameters
        let refreshRate = 300000; // 5 minutes fallback default if missing from sheet
        if (params["Refresh_Interval_MS"]) {
            const parsedRate = parseInt(params["Refresh_Interval_MS"].trim(), 10);
            if (!isNaN(parsedRate) && parsedRate > 0) {
                refreshRate = parsedRate;
            }
        }
        // Clear any existing timer cycle first to avoid stacking duplicate loops
        if (scheduleRefreshTimer) {
            clearInterval(scheduleRefreshTimer);
        }
        // Start the schedule calculation interval loop using your dynamic value
        scheduleRefreshTimer = setInterval(() => {
            console.log(`Recalculating timelines based on current device clock every ${refreshRate}ms...`);
            processAllSchedules();
        }, refreshRate);
        
        rawLocations.forEach(row => {
            if(row.Loc_ID) {
                dbLocations[row.Loc_ID.trim()] = {
                    name: row.Loc_Name ? row.Loc_Name.trim() : "Unknown Location",
                    latitude: row.Loc_Lat ? row.Loc_Lat.trim() : "",
                    longitude: row.Loc_Long ? row.Loc_Long.trim() : "",
                    mapUrl: row.Loc_Map_URL ? row.Loc_Map_URL.trim() : "#"
                };
            }
        });

        rawDetails.forEach(row => {
            if(row.Detail_ID) {
                /* Replace line breaks with <br> */
                let processedDesc = row.Detail_Descrip ? row.Detail_Descrip.trim() : "";
                processedDesc = processedDesc.replace(/\n/g, "<br>");
                
                dbDetails[row.Detail_ID.trim()] = {
                    name: row.Detail_Name ? row.Detail_Name.trim() : "No Details",
                    image: row.Detail_Image ? row.Detail_Image.trim() : "",
                    desc: processedDesc
                };
            }
        });

        dbEvents = rawEvents.map(row => {
            const locId = row.Event_Loc_ID ? row.Event_Loc_ID.trim() : "";
            const DtlId = row.Event_Details_ID ? row.Event_Details_ID.trim() : "";
            return {
                id: row.Event_ID ? row.Event_ID.trim() : "",
                name: row.Event_Name ? row.Event_Name.trim() : "Unnamed Event",
                start: row.Event_Start ? row.Event_Start.trim() : "",
                end: row.Event_End ? row.Event_End.trim() : "",
                locationName: dbLocations[locId]?.name || "Unknown Location",
                mapUrl: dbLocations[locId]?.mapUrl || "#",
                dname: dbDetails[DtlId]?.name || "",
                image: dbDetails[DtlId]?.image || "",
                details: dbDetails[DtlId]?.desc || ""
            };
        });

        dbStands = rawStands.map(row => {
            const locId = row.Stand_Loc_ID ? row.Stand_Loc_ID.trim() : "";
            return {
                id: row.Stand_ID ? row.Stand_ID.trim() : "",
                name: row.Stand_Name ? row.Stand_Name.trim() : "Unnamed Stand",
                start: row.Stand_Start ? row.Stand_Start.trim() : "",
                end: row.Stand_End ? row.Stand_End.trim() : "",
                locationName: dbLocations[locId]?.name || "Unknown Location",
                mapUrl: dbLocations[locId]?.mapUrl || "#"
            };
        });

        dbNews = rawNews.map(row => {
            let processedContent = row.News_Content ? row.News_Content.trim() : "";
            processedContent = processedContent.replace(/\n/g, "<br>"); 

            return {
                date: row.News_Date ? row.News_Date.trim() : "",
                title: row.News_Title ? row.News_Title.trim() : "Announcement",
                content: processedContent,
                image: row.News_Image ? row.News_Image.trim() : "",
                imageLoc: row.News_Image_Loc ? row.News_Image_Loc.trim().toUpperCase() : "L"
            };
        });
        
        processAllSchedules();
        renderNewsFeed();
    } catch (err) {
        console.error("Database initialization processing crash failure:", err);
        document.getElementById("all-events").innerText = "Failed to sync remote database entries.";
    }
}

function processAllSchedules() {
    const [targetYear, targetMonth, targetDay] = selectedDayString.split('-').map(Number);

    const isSelectedDay = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth && d.getDate() === targetDay;
    };

    const filteredEvents = dbEvents
        .filter(e => isSelectedDay(e.start))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    renderCards(filteredEvents, "all-events", "No events scheduled for this day.", false);

    const sortedStands = [...dbStands].sort((a, b) => a.name.localeCompare(b.name));
    
    renderCards(sortedStands, "all-stands", "No lemonade stands found.", false);
}

function renderCards(list, elementId, emptyMsg, isLive) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";

    if(list.length === 0) {
        container.innerHTML = `<p class="no-events">${emptyMsg}</p>`;
        return;
    }

    list.forEach((item, index) => {
        const startD = item.start ? new Date(item.start).toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' }) : "??";
        const startT = item.start ? new Date(item.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "??";
        const endT = item.end ? new Date(item.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "??";
        const indicator = isLive ? "⏰ " : "⏰ ";

        const hasDetailsButton = (item.details && item.details.trim() !== "") || (item.image && item.image.trim() !== "");
        const uniqueId = `${elementId}-details-${index}`;
        
        // Escape parameters cleanly for inline string safety checks
        const safeName = item.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const safeStart = item.start;
        const safeEnd = item.end;
        const safeLoc = item.locationName.replace(/'/g, "\\'").replace(/"/g, '\\"');

        const menuId = `${elementId}-remind-${index}`;

        container.innerHTML += `
            <div class="card">
                <span class="time">${indicator}- ${startD} ${startT} - ${endT}</span>
                <div class="card-title">${item.name}</div>
                <div class="location">📍 ${item.locationName}</div>
                <div class="card-actions">
                    ${hasDetailsButton ? `<button onclick="toggleCardDetails('${uniqueId}')" class="g-btn"><img src="images/buttons/view-details.webp" width="75%" alt="" /></button>` : ''}
                    ${item.mapUrl !== '#' ? `<button onclick="openLocationInAppMap('${item.mapUrl}')" class="g-btn"><img src="images/buttons/show-on-map.webp" width="75%" alt="" /></button>` : ''}
                    
                    <div class="reminder-dropdown">
                        <button onclick="toggleReminderMenu('${menuId}', event)" class="g-btn" ><img src="images/buttons/add-to-calendar.webp" width="75%" alt="" /></button>
                        <div id="${menuId}" class="reminder-menu">
                            <button onclick="openGoogleCalendar('${safeName}', '${safeStart}', '${safeEnd}', '${safeLoc}')">Google Calendar</button>
                            <button onclick="downloadAppleCalendar('${safeName}', '${safeStart}', '${safeEnd}', '${safeLoc}')">Apple / Outlook</button>
                        </div>
                    </div>
                </div>
                
                ${hasDetailsButton ? `
                    <div id="${uniqueId}" class="expanded-details">
                        ${item.dname ? `<h3>${item.dname}</h3>` : ''}
                        <div id="${uniqueId}-image" class="dtl-image">
                            ${item.image ? `<img src="${item.image}" alt="${item.dname || 'Details'}" />` : ''}
                        </div>
                        <p class="dtl-desc">${item.details || 'No detailed description provided.'}</p>
                    </div>
                ` : ''}
            </div>`;    
    });
}

// TOGGLE FUNCTION REPLACING MODAL HANDLERS
function toggleCardDetails(targetDivId) {
    const targetDiv = document.getElementById(targetDivId);
    if(targetDiv) {
        targetDiv.classList.toggle('show');
        
        // FIXED: Use .parentElement to find the card, then look inside it for the button
        const associatedButton = targetDiv.parentElement.querySelector('.dtl-btn');
        if (associatedButton) {
            associatedButton.innerText = targetDiv.classList.contains('show') ? "Hide Details" : "View Details";
        }
    }
}

function renderNewsFeed() {
    const newsContainer = document.getElementById("news-feed");
    if (!newsContainer) return;

    newsContainer.innerHTML = "";

    if (dbNews.length === 0) {
        newsContainer.innerHTML = `<p class="no-events">No news announcements posted yet.</p>`;
        return;
    }

    const sortedNews = [...dbNews].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedNews.forEach(item => {
        const displayDate = item.date 
            ? new Date(item.date).toLocaleDateString([], { month: 'short', day: '2-digit' }) + ", " + 
              new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : "Recent Update";

        // Determine layout class based on R or L parameter parameters
        const alignmentClass = item.imageLoc === "R" ? "news-float-r" : "news-float-l";
        
        // Build the image tag string if a URL string exists in your sheet cell
        const imageHtml = item.image 
            ? `<img src="${item.image}" class="news-thumb ${alignmentClass}" alt="News graphic" />` 
            : "";

        newsContainer.innerHTML += `
            <div class="card news-card">
                <div class="card-title" style="margin-top: 5px; margin-bottom: 5px;">${item.title}</div>
                ${imageHtml}
                <p class="dtl-desc" style="margin: 0; padding-top: 5px;">${item.content}</p>
            </div>`;
    });
}

function switchTab(target) {
    document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
    
    const targetScreen = document.getElementById(`${target}-screen`);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        targetScreen.scrollTop = 0; 
    }
    document.getElementById(`nav-${target}`).classList.add('active');
}
    
function openLocationInAppMap(mapUrl) {
    const mapIframe = document.querySelector('#map-screen iframe');
    if (mapIframe) {
        mapIframe.src = mapUrl;
    }
    switchTab('map');
}

function switchDay(dateStr, event) {
    selectedDayString = dateStr;
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    if(event && event.target) {
        event.target.classList.add('active');
    }
    processAllSchedules();
}

// Utility helper to convert sheet times into ISO basic strings (YYYYMMDDTHHMMSSZ)
function formatToCalTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    // Force format directly to UTC string layout layout
    return d.toISOString().replace(/-|:|\.\d\d\d/g, "");
}

// 1. GENERATE GOOGLE CALENDAR WEB LINK
function openGoogleCalendar(name, start, end, location) {
    const gStart = formatToCalTime(start);
    const gEnd = formatToCalTime(end);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(name)}&dates=${gStart}/${gEnd}&details=Set from Big Squeeze App&location=${encodeURIComponent(location)}&sf=true&output=xml`;
    window.open(url, '_blank');
}

// 2. GENERATE AND DOWNLOAD APPLE (.ICS) CARD FILE
function downloadAppleCalendar(name, start, end, location) {
    const iStart = formatToCalTime(start);
    const iEnd = formatToCalTime(end);
    
    // Create raw file context strings structures
    const icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Big Squeeze//Event Calendar//EN",
        "BEGIN:VEVENT",
        `SUMMARY:${name}`,
        `DTSTART:${iStart}`,
        `DTEND:${iEnd}`,
        `LOCATION:${location}`,
        "DESCRIPTION:Reminder from The Big Squeeze App",
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `${name.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 3. UI TOGGLE HANDLER FOR DROPDOWN MENUS
function toggleReminderMenu(menuId, event) {
    event.stopPropagation(); // Prevents clicks from firing parent layout cards operations
    // Close any other open reminder menus first
    document.querySelectorAll('.reminder-menu').forEach(m => {
        if(m.id !== menuId) m.classList.remove('show');
    });
    document.getElementById(menuId).classList.toggle('show');
}

// Close dropdowns automatically if the user clicks anywhere else on the window screen
window.addEventListener('click', () => {
    document.querySelectorAll('.reminder-menu').forEach(m => m.classList.remove('show'));
});

initDatabaseApp();
