# Newton 

A modern, React-based chat application with AI capabilities, featuring real-time streaming responses, bilingual support, dynamic forms, and comprehensive admin management.

## Features

- 🤖 **Real-time AI Chat** - Streaming chat interface with Server-Sent Events (SSE)
- 🌍 **Bilingual Support** - English and Arabic language support
- 📝 **Dynamic Forms** - Multi-language form generation with validation
- 🎴 **Card System** - Rich content display with recommendations
- 👥 **Admin Dashboard** - User, role, and tool management
- 📧 **Email Integration** - Gmail and Outlook integration
- 🎨 **Theme System** - Multiple customizable themes
- 🔐 **Role-Based Access Control (RBAC)** - Secure permission management
- 📄 **Document Management** - Upload and manage private documents
- 📅 **Calendar Integration** - Schedule and manage events
- 🔍 **Web Analysis** - Analyze web content and documents

## Tech Stack

- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.2
- **State Management**: Zustand 4.5.1
- **Routing**: React Router 7.5.0
- **UI Components**: Radix UI, Tailwind CSS
- **Form Management**: React Hook Form 7.54.2
- **Animations**: Framer Motion 12.6.2
- **HTTP Client**: Axios, Fetch API
- **PWA Support**: Vite PWA Plugin

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn package manager
- Access to Newton API backend services

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd newton-ui
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

4. Configure your `.env` file with the required values (see [Environment Variables](#environment-variables) section below).

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_ACTIVE_THEME="Gemini"
VITE_ENABLE_UPLOAD_IMAGE="true"
VITE_SHOW_REASONING=true
VITE_DEV_HTTPS=true
VITE_DEV_PORT=5175
VITE_API_BASE_URL=""                  # API root; app uses /mid, /core, /auth (see config/api.ts)
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (with increased memory limit)
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Project Structure

```
newton-ui/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard/       # Admin dashboard components
│   │   ├── ChatContainer/   # Chat interface components
│   │   ├── DynamicForm/     # Dynamic form components
│   │   └── ui/              # Reusable UI components
│   ├── services/            # API service modules
│   ├── store/               # Zustand state management
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   └── types/               # TypeScript type definitions
├── docs/                    # Project documentation
├── public/                  # Static assets
└── dist/                    # Production build output
```

## Development

### Starting the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the port specified by Vite).

### Building for Production

```bash
npm run build
```

The production build will be output to the `dist/` directory.

## Docker Deployment

The project includes Docker support:

```bash
# Build Docker image
docker build -t newton-ui .

# Run with docker-compose
docker-compose up
```

## Documentation

For detailed documentation, see the [docs](./docs/) directory:

- [Project Documentation](./docs/PROJECT_DOCUMENTATION.md) - Comprehensive project overview and API documentation
- [Dynamic Forms](./docs/DYNAMIC_FORMS.md) - Dynamic form system documentation
- [Bilingual Form System](./docs/BILINGUAL_FORM_SYSTEM_README.md) - Multi-language form support
- [UI Standards](./docs/UI_STANDARDIZATION.md) - UI component standards and guidelines
- [Blocks Integration](./docs/BLOCKS_INTEGRATION_EXAMPLES.md) - Integration examples

## Key Features Documentation

### Chat System
- Real-time streaming responses via Server-Sent Events
- Session management with persistent storage
- File attachment support
- Email context integration

### Dynamic Forms
- Multi-language form generation
- Field validation and error handling
- Conditional field display
- Form submission handling

### Admin Dashboard
- User management
- Role and permission management
- Tool configuration
- System settings

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure code follows the project's linting rules
4. Submit a pull request

## License

[Add your license information here]

## Support

For issues and questions, please refer to the project documentation or contact the development team.

