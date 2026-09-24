import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faSearch, faFile, faFileLines, faFilePdf, faFolderOpen, faFolder, faPaperclip, faClipboard, faClipboardList,
  faUser, faUsers, faUserTie, faBuilding, faUserGraduate, faChalkboardUser, faUserShield, faShieldHalved, faShield,
  faLock, faUnlock, faKey, faUnlockKeyhole,
  faBullseye, faCrosshairs, faTrophy, faMedal, faStar, faRankingStar, faChartBar, faChartLine, faChartPie, faTable, faDatabase, faServer,
  faBolt, faBrain, faRobot, faRocket, faGear, faGears, faWrench, faScrewdriverWrench, faTools,
  faBell, faEnvelope, faPaperPlane, faComment, faComments, faMessage, faLightbulb, faBook, faBookOpen, faBookmark,
  faUpload, faDownload, faArrowUp, faArrowDown, faArrowRight, faArrowLeft, faArrowRotateRight, faRotate, faRefresh, faSync, faArrowsRotate,
  faCheck, faXmark, faPlus, faMinus, faEquals, faPen, faPencil, faTrash, faTrashCan, faEye, faEyeSlash, faSliders, faFilter, faSort, faSortUp, faSortDown,
  faCalendar, faCalendarDays, faClock, faHourglass, faStopwatch, faCalendarCheck,
  faGraduationCap, faBriefcase, faSuitcase, faCode, faTerminal, faLaptopCode, faLaptop, faDesktop, faMobile, faPhone, faMicrochip, faSatellite, faFlask, faVial,
  faCircleExclamation, faTriangleExclamation, faCircleQuestion, faCircleInfo, faWarning,
  faHome, faHouse, faLocationDot, faMapLocationDot, faMap, faGlobe, faEarthAmericas,
  faSun, faMoon, faCloudSun, faCloud, faUmbrella, faPalette, faPaintbrush,
  faSave, faFloppyDisk, faHardDrive, faCompactDisc,
  faBars, faBarsStaggered, faClose, faTimes, faList, faListCheck, faCheckSquare, faSquareCheck, faSquare, faCircle, faCircleDot,
  faTags, faTag, faFlag, faShare, faShareNodes, faLink, faChain, faCopy, faClone, faPaste, faScissors,
  faCameraRetro, faImage, faImagePortrait, faVideo, faMicrophone, faHeadphones, faPodcast, faMusic,
  faLeaf, faTree, faSeedling,
  faCreditCard, faMoneyBill, faDollarSign, faWallet, faCoins,
  faGift, faCake,
  faHandshake, faPeopleGroup, faUserGroup, faUsersGear, faUserCheck, faUserPlus, faUserMinus,
  faMagnifyingGlass, faMagnifyingGlassPlus, faMagnifyingGlassMinus,
  faScaleBalanced,
  faHospital, faStethoscope, faPills, faCapsules, faSyringe, faBandage,
  faKitMedical, faThermometerHalf, faDroplet, faBacteria, faVirus, faDna,
  faBuildingColumns, faUniversity, faSchool,
  faBox, faBoxesStacked, faBoxArchive, faArchive, faInbox, faEnvelopeOpen, faEnvelopesBulk, faNewspaper,
  faShareFromSquare, faArrowUpFromBracket, faArrowUpRightFromSquare,
  faEraser, faBroom,
  faCircleNotch, faSpinner,
  faQrcode, faBarcode, faPrint, faWifi, faSignal,
  faBug, faShieldVirus, faFire, faFireExtinguisher, faBomb,
  faTruck, faPlane, faCar, faTrain, faShip,
  faRightFromBracket, faCalculator, faGaugeHigh, faGauge,
  faCircleCheck, faCircleXmark, faLayerGroup, faTableColumns,
} from '@fortawesome/free-solid-svg-icons';

library.add(
  faSearch, faFile, faFileLines, faFilePdf, faFolderOpen, faFolder, faPaperclip, faClipboard, faClipboardList,
  faUser, faUsers, faUserTie, faBuilding, faUserGraduate, faChalkboardUser, faUserShield, faShieldHalved, faShield,
  faLock, faUnlock, faKey, faUnlockKeyhole,
  faBullseye, faCrosshairs, faTrophy, faMedal, faStar, faRankingStar, faChartBar, faChartLine, faChartPie, faTable, faDatabase, faServer,
  faBolt, faBrain, faRobot, faRocket, faGear, faGears, faWrench, faScrewdriverWrench, faTools,
  faBell, faEnvelope, faPaperPlane, faComment, faComments, faMessage, faLightbulb, faBook, faBookOpen, faBookmark,
  faUpload, faDownload, faArrowUp, faArrowDown, faArrowRight, faArrowLeft, faArrowRotateRight, faRotate, faRefresh, faSync, faArrowsRotate,
  faCheck, faXmark, faPlus, faMinus, faEquals, faPen, faPencil, faTrash, faTrashCan, faEye, faEyeSlash, faSliders, faFilter, faSort, faSortUp, faSortDown,
  faCalendar, faCalendarDays, faClock, faHourglass, faStopwatch, faCalendarCheck,
  faGraduationCap, faBriefcase, faSuitcase, faCode, faTerminal, faLaptopCode, faLaptop, faDesktop, faMobile, faPhone, faMicrochip, faSatellite, faFlask, faVial,
  faCircleExclamation, faTriangleExclamation, faCircleQuestion, faCircleInfo, faWarning,
  faHome, faHouse, faLocationDot, faMapLocationDot, faMap, faGlobe, faEarthAmericas,
  faSun, faMoon, faCloudSun, faCloud, faUmbrella, faPalette, faPaintbrush,
  faSave, faFloppyDisk, faHardDrive, faCompactDisc,
  faBars, faBarsStaggered, faClose, faTimes, faList, faListCheck, faCheckSquare, faSquareCheck, faSquare, faCircle, faCircleDot,
  faTags, faTag, faFlag, faShare, faShareNodes, faLink, faChain, faCopy, faClone, faPaste, faScissors,
  faCameraRetro, faImage, faImagePortrait, faVideo, faMicrophone, faHeadphones, faPodcast, faMusic,
  faLeaf, faTree, faSeedling,
  faCreditCard, faMoneyBill, faDollarSign, faWallet, faCoins,
  faGift, faCake,
  faHandshake, faPeopleGroup, faUserGroup, faUsersGear, faUserCheck, faUserPlus, faUserMinus,
  faMagnifyingGlass, faMagnifyingGlassPlus, faMagnifyingGlassMinus,
  faScaleBalanced,
  faHospital, faStethoscope, faPills, faCapsules, faSyringe, faBandage,
  faKitMedical, faThermometerHalf, faDroplet, faBacteria, faVirus, faDna,
  faBuildingColumns, faUniversity, faSchool,
  faBox, faBoxesStacked, faBoxArchive, faArchive, faInbox, faEnvelopeOpen, faEnvelopesBulk, faNewspaper,
  faShareFromSquare, faArrowUpFromBracket, faArrowUpRightFromSquare,
  faEraser, faBroom,
  faCircleNotch, faSpinner,
  faQrcode, faBarcode, faPrint, faWifi, faSignal,
  faBug, faShieldVirus, faFire, faFireExtinguisher, faBomb,
  faTruck, faPlane, faCar, faTrain, faShip,
  faRightFromBracket, faCalculator, faGaugeHigh, faGauge,
  faCircleCheck, faCircleXmark, faLayerGroup, faTableColumns
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
