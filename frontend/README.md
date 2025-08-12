# Call Analysis System - Frontend

A comprehensive React-based frontend application for real-time call analysis, sentiment tracking, and call center management.

## 🚀 Features

### Authentication & User Management
- **Secure Login/Logout**: JWT-based authentication with token management
- **Password Reset**: Forgot password and reset functionality
- **User Management**: CRUD operations for agents, team leads, and admins
- **Role-Based Access Control**: Different permissions for different user roles

### Dashboard & Analytics
- **Real-time Dashboard**: Live metrics, agent status, and active calls
- **Key Performance Indicators**: Total agents, team leads, live calls, active agents
- **Agent Monitoring**: Real-time status tracking (online, offline, busy)
- **Call Overview**: Active calls with sentiment analysis

### Call History & Management
- **Comprehensive Call History**: Search, filter, and pagination
- **Advanced Filtering**: By agent, team, status, sentiment, and date range
- **Export Functionality**: CSV export for call data
- **Call Details**: Detailed view with audio player and transcript

### Live Call Analysis
- **Real-time Sentiment Tracking**: Live sentiment analysis with confidence scores
- **Question Detection**: Automatic detection and categorization of questions
- **Vulnerability Alerts**: Real-time customer vulnerability detection
- **Event Management**: Live event tracking and severity classification
- **Performance Metrics**: Live performance indicators and trends

### Call Audit & Reporting
- **Audio Player**: Built-in audio player for call playback
- **Sentiment Analysis Charts**: Visual representation of sentiment over time
- **Transcription**: Real-time transcription with speaker identification
- **Compliance Monitoring**: Compliance scoring and issue tracking
- **Call Scoring**: Automated call quality scoring (0-100)
- **Keywords Detection**: Automatic keyword extraction and highlighting

### Overview Dashboard
- **Productivity Analytics**: Productivity vs unproductivity metrics
- **Speech Analysis**: Breakdown of speech, silence, crosstalk, and music
- **Call Type Distribution**: Conventional vs non-conventional call analysis
- **Performance Trends**: Historical performance tracking

### Real-time Communication
- **WebSocket Integration**: Real-time updates and live data streaming
- **Live Messaging**: Supervisor-to-agent messaging system
- **Real-time Notifications**: Live alerts and status updates

## 🛠️ Technology Stack

- **React 19**: Latest React with hooks and functional components
- **TypeScript**: Type-safe development
- **Material-UI (MUI)**: Modern, responsive UI components
- **React Router**: Client-side routing
- **Socket.io Client**: Real-time communication
- **Axios**: HTTP client for API communication
- **Recharts**: Data visualization and charts
- **Date-fns**: Date manipulation utilities
- **Vite**: Fast build tool and development server

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CallAnalysisSystem/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the frontend directory:
   ```env
   VITE_API_URL=http://localhost:3000
   VITE_SOCKET_URL=http://localhost:3001
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 🏗️ Project Structure

```
src/
├── components/
│   └── Layout/
│       └── Layout.tsx          # Main layout with sidebar and header
├── contexts/
│   ├── AuthContext.tsx         # Authentication state management
│   └── SocketContext.tsx       # WebSocket connection management
├── pages/
│   ├── Auth/
│   │   ├── Login.tsx           # Login page
│   │   ├── ForgotPassword.tsx  # Password reset request
│   │   └── ResetPassword.tsx   # Password reset form
│   ├── Dashboard/
│   │   └── Dashboard.tsx       # Main dashboard with KPIs
│   ├── CallHistory/
│   │   └── CallHistory.tsx     # Call history with filtering
│   ├── UserManagement/
│   │   └── UserManagement.tsx  # User CRUD operations
│   ├── LiveCallAnalysis/
│   │   └── LiveCallAnalysis.tsx # Real-time call monitoring
│   ├── OverviewDashboard/
│   │   └── OverviewDashboard.tsx # Analytics and trends
│   ├── CallAuditReport/
│   │   └── CallAuditReport.tsx # Detailed call audit
│   └── CallDetails/
│       └── CallDetails.tsx     # Live call details
├── App.tsx                     # Main application component
└── main.tsx                    # Application entry point
```

## 🔧 Configuration

### API Endpoints
The application expects the following API endpoints:

- **Authentication**: `/api/auth/*`
- **Dashboard**: `/api/dashboard/*`
- **Call History**: `/api/call-history`
- **User Management**: `/api/users/*`
- **Call Details**: `/api/call-details/*`
- **Call Audit**: `/api/call-audit/*`

### WebSocket Events
The application listens for these real-time events:

- `agent_status_update`: Agent status changes
- `call_started`: New call initiated
- `call_ended`: Call completed
- `sentiment_update`: Sentiment analysis updates
- `question_detected`: Question detection events
- `vulnerability_detected`: Vulnerability alerts
- `event_triggered`: System events
- `transcript_update`: Live transcript updates
- `message_received`: New messages

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Theme**: Material-UI theming system
- **Real-time Updates**: Live data without page refresh
- **Interactive Charts**: Dynamic data visualization
- **Accessibility**: WCAG compliant components
- **Loading States**: Proper loading indicators
- **Error Handling**: User-friendly error messages

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Route Protection**: Protected routes for authenticated users
- **Role-based Access**: Different views based on user roles
- **Secure API Calls**: Authenticated API requests
- **Input Validation**: Client-side form validation

## 📊 Data Visualization

- **Line Charts**: Sentiment trends over time
- **Pie Charts**: Sentiment distribution
- **Bar Charts**: Performance metrics
- **Area Charts**: Productivity trends
- **Progress Bars**: Real-time progress indicators
- **Gauges**: Performance scores

## 🚀 Performance Optimizations

- **Code Splitting**: Lazy loading of components
- **Memoization**: React.memo for expensive components
- **Debounced Search**: Optimized search functionality
- **Virtual Scrolling**: For large data sets
- **Image Optimization**: Optimized assets

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/verify` - Verify token

### Dashboard Endpoints
- `GET /api/dashboard/metrics` - Get dashboard KPIs
- `GET /api/dashboard/agents` - Get agent list
- `GET /api/dashboard/active-calls` - Get active calls

### Call Management Endpoints
- `GET /api/call-history` - Get call history with filters
- `GET /api/call-details/:id` - Get call details
- `GET /api/call-audit/:id` - Get call audit report
- `POST /api/call-details/:id/messages` - Send message to agent

### User Management Endpoints
- `GET /api/users` - Get users list
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

## 🔄 Version History

- **v1.0.0**: Initial release with core features
- **v1.1.0**: Added real-time analytics
- **v1.2.0**: Enhanced user management
- **v1.3.0**: Improved call audit features

---

**Built with ❤️ for Call Center Excellence**
