from fastapi import APIRouter
from .controllers import router as controller_router
from .controllers_view import router as view_router

# This is a pass-through router that imports from controllers
# You could add additional routes or middleware here if needed
router = APIRouter()
router.include_router(controller_router)
router.include_router(view_router)
